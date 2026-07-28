/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // Preview de conversa — só existe em desenvolvimento. O app secret é o mesmo do envs/env.dev,
  // usado para assinar o webhook local; nunca aponte para o segredo real de staging/produção.
  readonly VITE_PREVIEW_ENABLED?: string
  readonly VITE_PREVIEW_APP_SECRET?: string
  readonly VITE_PREVIEW_PHONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
