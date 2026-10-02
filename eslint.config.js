import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Backend/Cardora is a nested, independently git-tracked repo with its own
  // Node/Jest toolchain — linting it here reports its `process`/`describe`/
  // `expect` globals as no-undef under this config's browser globals (275
  // phantom errors that buried every real frontend one). Mirrors the same
  // exclusion vite.config.js applies to vitest.
  globalIgnores(['dist', 'Backend/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none' }],
      // React-compiler advice, not defects: these effects sync state from props/
      // storage on mount and work correctly. Surfaced as warnings so they stay
      // visible without drowning real errors; refactor opportunistically.
      'react-hooks/set-state-in-effect': 'warn',
      // Dev-only (fast refresh) concern for files that export a component
      // plus a helper/constant.
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // api/ holds Vercel serverless functions (crawler Open Graph rendering).
    // (vite.config.js is Node too.) They run on Node, so `process` is defined and there is no browser DOM.
    files: ['api/**/*.js', 'vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
