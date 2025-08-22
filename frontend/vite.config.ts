import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['tinymce']
  },
  build: {
    rollupOptions: {
      external: [],
    }
  },
  server: {
    fs: {
      allow: ['..', 'node_modules/tinymce']
    }
  }
})
