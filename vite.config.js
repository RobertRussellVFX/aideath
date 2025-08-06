import { defineConfig } from 'vite'

export default defineConfig({
  preview: {
    allowedHosts: [
      'healthcheck.railway.app',
      'aideath-frontend-production.up.railway.app'
    ]
  }
})