import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function resolveGitCommit(): string {
  if (process.env.VITE_GIT_COMMIT) return process.env.VITE_GIT_COMMIT
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react()],
  base: '/Weight-Data-Manager/',
  define: {
    __APP_GIT_COMMIT__: JSON.stringify(resolveGitCommit()),
  },
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
