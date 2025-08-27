import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/pentagram',
  // Root directory for source files
  root: '.',
  
  // Build optimizations
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      external: ['trystero', '@noble/ed25519', 'uuid']
    }
  },

  // Development server
  server: {
    port: 3000,
    host: true, // Allow network access
    open: false, // Don't auto-open browser (Playwright will handle this)
    cors: true
  },

  // Plugins
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Pentagram.foo',
        short_name: 'Pentagram',
        description: 'Anonymous serverless WebRTC chat',
        theme_color: '#7c3aed',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        shortcuts: [
          {
            name: 'Join Room',
            short_name: 'Join',
            description: 'Join a chat room',
            url: '/',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          }
        ],
        share_target: {
          action: '/',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        }
      }
    })
  ],

  // Resolve configuration
  resolve: {
    alias: {
      '@': '/src'
    }
  },

  // CSS processing
  css: {
    postcss: './postcss.config.js'
  }
})