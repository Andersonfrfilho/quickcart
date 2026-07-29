import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'QuickCart',
        short_name: 'QuickCart',
        description: 'Supermercado rápido no seu WhatsApp',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/v1\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 100, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  // O SDK entra por `bun link`, apontando para o `dist` de outro repositório. Pré-bundlado, o Vite
  // congela uma cópia em `node_modules/.vite` e NÃO a invalida quando aquele dist é reconstruído —
  // o navegador segue recebendo a versão antiga, sem erro nenhum, e a única pista é a mudança não
  // aparecer. Custou horas de "não funciona" que já estava corrigido. Excluir do pré-bundle troca um
  // pouco de tempo de carga por ver sempre o build atual.
  optimizeDeps: {
    exclude: ['@adatechnology/conversations-ui'],
  },
  server: {
    port: 5183,
    proxy: {
      '/v1': { target: 'http://localhost:3344', changeOrigin: true },
    },
  },
})
