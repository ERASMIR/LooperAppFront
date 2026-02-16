import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-usuarios': {
        target: 'http://localhost:7073',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-usuarios/, '/api'),
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      },
      '/api-procesar': {
        target: 'https://looperapp.azurewebsites.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-procesar/, '/api'),
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      },
      '/api-gestdoc': {
        target: 'https://looper-gestdoc.azurewebsites.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-gestdoc/, '/api'),
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      },
      '/api-gestreport': {
        target: 'https://looper-gestreport.azurewebsites.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-gestreport/, '/api'),
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    }
  }
})