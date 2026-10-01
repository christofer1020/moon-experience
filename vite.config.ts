import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build can be hosted from any sub-path (GitHub Pages, S3, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          astro: ['astronomy-engine'],
        },
      },
    },
  },
  server: { port: 5173 },
})
