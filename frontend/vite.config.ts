import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the API runs on :8000 and is proxied, so the frontend can
// use relative URLs and no CORS setup is needed locally.
const api = process.env.VITE_DEV_API ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': api,
      '/media': api,
    },
  },
})
