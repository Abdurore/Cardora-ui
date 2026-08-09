import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
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
})
