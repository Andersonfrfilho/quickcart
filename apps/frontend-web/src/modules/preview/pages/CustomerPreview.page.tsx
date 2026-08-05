/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Preview cliente: você digita como o cliente e o bot responde.
 *
 * O navegador manda a INTENÇÃO (`{ kind: 'text', text }`) para a rota de preview da API; é ela que
 * monta o payload da Meta, assina com o app secret e entrega no webhook REAL, com a mesma validação
 * de HMAC de staging e produção. Nada de segredo no bundle: assinar aqui exigiria `VITE_*`, que é
 * literal inlinado no JavaScript servido — publicar o app secret para quem baixasse a página.
 */

import { useMemo } from 'react'
import '@adatechnology/conversations-ui/styles.css'
import { ConversationPreview, createPreviewBridgeClient } from '@adatechnology/conversations-ui/preview'
import { readPreviewEnvironment } from '@/modules/preview/shared/previewEnvironment'
import { fetchPreviewTranscript } from '@/modules/preview/shared/previewTranscript'


/**
 * SSE que não conecta. O `ConversationPreview` sempre assina o stream, e sem sessão cada assinatura
 * pedia um ticket de admin que voltava 401 — inclusive no ciclo de remontagem do StrictMode, que
 * dobra a conta.
 */
const INERT_SSE = {
  connectConversationStream: (): EventSource =>
    ({
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      close: () => undefined,
    }) as unknown as EventSource,
  connectGlobalStream: (): EventSource =>
    ({
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      close: () => undefined,
    }) as unknown as EventSource,
}

export function CustomerPreviewPage() {
  const environment = useMemo(() => readPreviewEnvironment(), [])
  const client = useMemo(
    () =>
      createPreviewBridgeClient({
        endpointUrl: environment.inboundUrl,
        from: environment.customerPhone,
      }),
    [environment],
  )

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Preview do cliente</h1>
        <p className="text-sm text-gray-500">
          Enviando como {environment.customerPhone} — webhook real, assinado pelo servidor.
        </p>

      </header>

      {/* Sem sessão, nem tenta: ler o transcript e abrir o SSE são rotas de admin, e insistir nelas
          só produzia enxurrada de 401 no console — a cada render, a cada envio, a cada tentativa de
          reconexão. O envio não depende de sessão e continua igual. */}
      <ConversationPreview
        client={client}
        // Continua sem SSE: o stream é rota de admin. O refresh após cada envio já traz a resposta
        // do bot, que é o que se quer observar aqui.
        sse={INERT_SSE}
        conversationId={environment.customerPhone}
        loadMessages={fetchPreviewTranscript}
        // Sem SSE aqui (o stream é rota de admin), então o transcript se atualiza por polling —
        // é o que faz a resposta do bot aparecer sozinha, sem depender do próximo envio.
        pollIntervalMs={2500}
        /**
         * É `uploadMedia` que faz o microfone aparecer: o simulador manda webhook, e webhook da Meta
         * carrega referência de mídia, nunca o binário. O helper do SDK guarda o arquivo pela rota de
         * dev e devolve o id prefixado que o canal reconhece — sem isso o gravador ficaria escondido,
         * corretamente, porque não teria onde pôr o áudio.
         */
      />
    </div>
  )
}
