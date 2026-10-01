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
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('node_modules/astronomy-engine/')) return 'astro'
          return undefined
        },
      },
    },
  },
  server: { port: 5173 },
})
