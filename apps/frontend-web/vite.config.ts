import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Config como FUNÇÃO para poder usar `loadEnv`: o `vite.config` é avaliado antes de o Vite carregar
 * os arquivos `.env`, então `process.env.VITE_*` está vazio aqui. Sem isto, o alvo do proxy caía no
 * default e as chamadas iam para a api errada — 404 na tela, com a requisição aparecendo no painel
 * de rede como se estivesse tudo certo.
 */
export default defineConfig(({ mode }) => ({
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
   * Existia para quando o pacote entrava por `bun link`: pré-bundlado, o Vite congela uma cópia em
   * `node_modules/.vite` e não a invalida quando o `dist` do outro repositório é reconstruído. Com o
   * pacote vindo do registry em versão fixada, o `dist` é imutável e o problema não existe.
   *
   * E o contorno virou a causa: fora do pré-bundle, o Vite serve o pacote cru por `/@fs/`, sem shim
   * de interop para as dependências CJS dele — `use-sync-external-store/shim/with-selector` quebra
   * com "does not provide an export named 'default'" e o app não monta, com a raiz vazia e o console
   * limpo. Nenhuma pista aponta para cá.
   *
   * Para linkar pacote local de novo, prefira `overrides` com tarball do `pnpm pack`: versão fixa,
   * pré-bundle funcionando, sem cache preso.
   */
  server: {
    port: 5183,
    proxy: {
      /**
       * Alvo por env para worktrees conviverem: cada um sobe a api numa porta e aponta o proxy pela
       * própria `.env.local`, sem editar (e comitar) este arquivo.
       */
      '/v1': { target: loadEnv(mode, process.cwd(), '').VITE_API_PROXY_TARGET || 'http://localhost:3344', changeOrigin: true },
    },
  },
}))
