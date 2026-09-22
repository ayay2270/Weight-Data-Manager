import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Weight-Data-Manager/',
  server: {
    host: '127.0.0.1',
    port: 43122,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
  },
})
