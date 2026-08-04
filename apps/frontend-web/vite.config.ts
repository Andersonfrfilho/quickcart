import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Config como FUNÇÃO para poder usar `loadEnv`: o `vite.config` é avaliado ANTES de o Vite carregar
 * os `.env`, então `process.env.VITE_*` está vazio aqui. Sem isto o alvo do proxy caía no default e
 * as chamadas iam para a api errada — 404 na tela, com a requisição aparecendo no painel de rede
 * como se estivesse tudo certo.
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
  // O SDK entra por `bun link`, apontando para o `dist` de outro repositório. Pré-bundlado, o Vite
  // congela uma cópia em `node_modules/.vite` e NÃO a invalida quando aquele dist é reconstruído —
  // o navegador segue recebendo a versão antiga, sem erro nenhum, e a única pista é a mudança não
  // aparecer. Custou horas de "não funciona" que já estava corrigido. Excluir do pré-bundle troca um
  // pouco de tempo de carga por ver sempre o build atual.
  /*
   * Pré-bundle do SDK: ligado quando ele vem do registry, desligado quando vem de `bun link`.
   *
   * Excluir `conversations-ui` existia por um motivo real: como symlink para o fonte do SDK, o pacote
   * pré-bundleado ficava congelado e o navegador seguia recebendo a versão antiga sem erro nenhum — a
   * única pista era a mudança não aparecer, e isso custou horas de "não funciona" já corrigido.
   *
   * Só que, vindo do registry, excluir QUEBRA a aplicação: o Vite serve o ESM cru do pacote e não
   * reescreve os `import` internos dele, então a dependência CommonJS `use-sync-external-store` chega
   * ao navegador sem `default` export — tela branca, sem erro no terminal. Pôr a dependência em
   * `include` não resolve, porque a reescrita não acontece dentro de pacote excluído.
   *
   * Então a exclusão passa a ser opt-in de quem está editando o SDK: `VITE_SDK_LINKED=1 make dev-web`
   * depois de `make link-sdk`. O padrão é pré-bundlear, que é o caminho de quem só roda o quickcart.
   */
  optimizeDeps: {
    exclude: process.env.VITE_SDK_LINKED === '1' ? ['@adatechnology/conversations-ui'] : [],
  },
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
