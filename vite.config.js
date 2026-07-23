import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 'standalone' is critical for hiding the Chrome URL bar
      manifest: {
        name: 'Utang CP App',
        short_name: 'Utang App',
        description: 'Manage credit and payments effortlessly',
        theme_color: '#4F46E5', // Matches your app's brand color
        background_color: '#ffffff',
        display: 'standalone', // <--- This MUST be 'standalone'
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png', // Verify this file is in your public/ folder
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // Verify this file is in your public/ folder
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})