import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API server runs separately (npm run server:demo or npm run server).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
})
