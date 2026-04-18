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
})
