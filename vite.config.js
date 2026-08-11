import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Vite inlines `import.meta.env.VITE_*` at BUILD time, so a variable that is
// missing when the bundle is built is missing forever in that bundle — there is
// no runtime lookup to fix later. That failure is silent by default: in
// production, `uploadToCloudinary`'s guard folded to `true`, the minifier
// dropped the entire upload implementation, and the deployed chunk became a
// bare `throw new Error('Cloudinary is not configured…')`. Every upload in
// production failed while the build reported success.
//
// So: refuse to produce that bundle on a deploy. This only runs for `vite build`
// — dev servers and vitest are untouched.
//
// Strict on a deploy host (Vercel sets VERCEL, most CI sets CI), advisory
// locally: a contributor with no .env, or one deliberately pointing at a local
// backend, must still be able to build and test the app. The silent-breakage
// risk only exists for the artifact that actually reaches users.
//
// Escape hatch even on a host: SKIP_ENV_CHECK=1 (for a deliberate build
// without media uploads).
function checkDeployableEnv(mode) {
  if (process.env.SKIP_ENV_CHECK === '1') return

  const isDeploy = Boolean(process.env.VERCEL || process.env.CI)

  // Deploy hosts inject via process.env; local work uses .env files. Check
  // both, preferring the real environment.
  const fromFiles = loadEnv(mode, process.cwd(), 'VITE_')
  const read = (key) => (process.env[key] ?? fromFiles[key] ?? '').trim()

  const problems = []

  for (const key of ['VITE_CLOUDINARY_CLOUD_NAME', 'VITE_CLOUDINARY_UPLOAD_PRESET']) {
    if (!read(key)) problems.push(`  - ${key} is missing or empty — media uploads will throw`)
  }

  // An unset API base is fine (src/lib/api.js falls back to the deployed
  // backend), but a localhost value baked into a deployed bundle points every
  // visitor at a machine that isn't theirs. Only a problem when deploying —
  // locally it is the normal way to develop against a local backend.
  const apiBase = read('VITE_API_BASE_URL')
  if (isDeploy && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(apiBase)) {
    problems.push(`  - VITE_API_BASE_URL points at a local address (${apiBase})`)
  }

  if (!problems.length) return

  const detail =
    `${problems.join('\n')}\n\n` +
    'These are compiled into the JS at build time, so setting them after a\n' +
    'deploy does nothing — the app must be rebuilt. On Vercel add them under\n' +
    'Settings > Environment Variables (scope: Production), then redeploy.\n' +
    'Locally, copy .env.example to .env and fill it in.\n\n' +
    'The Cloudinary preset must be an UNSIGNED preset — uploadToCloudinary\n' +
    'posts upload_preset with no signature.\n'

  if (isDeploy) {
    throw new Error(
      `\n\nBuild stopped — this bundle would be broken in production:\n\n${detail}\n` +
      'To deploy deliberately without media uploads: set SKIP_ENV_CHECK=1\n'
    )
  }

  console.warn(
    `\n\x1b[33m⚠  Local build is missing production env vars:\x1b[0m\n\n${detail}\n` +
    '\x1b[33mBuilding anyway (local build). This WOULD fail on a deploy host.\x1b[0m\n'
  )
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') checkDeployableEnv(mode)

  return {
    plugins: [react()],
    preview: {
      port: 4173,
      // Serve index.html for all routes so React Router handles them
      historyApiFallback: true,
    },
    server: {
      historyApiFallback: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      // Backend/Cardora is a nested, independently git-tracked repo with its
      // own Jest test suite — exclude it so vitest doesn't try to run it too.
      exclude: ['**/node_modules/**', 'Backend/**'],
    },
  }
})
