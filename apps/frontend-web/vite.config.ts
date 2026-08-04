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
  /**
   * O `exclude` de `@adatechnology/conversations-ui` saiu daqui.
   *
   * Ele existia para o tempo em que o pacote entrava por `bun link`: pré-bundlado, o Vite congela
   * uma cópia em `node_modules/.vite` e não a invalida quando o `dist` do outro repositório é
   * reconstruído. Com o pacote vindo do registry em versão fixada, o `dist` é imutável e o problema
   * não existe.
   *
   * E o contorno passou a ser a causa: fora do pré-bundle, o Vite serve o pacote cru por `/@fs/`,
   * sem o shim de interop para as dependências CJS dele — `use-sync-external-store/shim/
   * with-selector` quebra com "does not provide an export named 'default'", e o app não monta com a
   * raiz vazia e o console limpo.
   *
   * Se algum dia voltar a linkar um pacote localmente, prefira `overrides` para um tarball do
   * `pnpm pack` — versão fixa, pré-bundle funcionando, e sem cache preso.
   */
  server: {
    port: 5183,
    proxy: {
      '/v1': { target: 'http://localhost:3344', changeOrigin: true },
    },
  },
})
