/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Preview cliente: você digita como o cliente e o bot responde. A mensagem sai assinada para o
 * webhook REAL — mesma rota, mesma validação de HMAC de staging e produção. Não há rota de dev
 * nem bypass; o que muda é apenas quem assina.
 */

import { useMemo } from 'react'
import '@adatechnology/conversations-ui/styles.css'
import { ConversationPreview, createPreviewWebhookClient } from '@adatechnology/conversations-ui/preview'
import { conversationsApi } from '@/modules/conversations/shared/conversationsApi'
import { conversationsSse } from '@/modules/conversations/shared/conversationsSse'
import { readPreviewEnvironment } from '@/modules/preview/shared/previewEnvironment'
import { getAdminToken } from '@/modules/admin/shared/useAdminAuth.hook'

export function CustomerPreviewPage() {
  const environment = useMemo(() => readPreviewEnvironment(), [])
  const hasAdminSession = useMemo(() => Boolean(getAdminToken()), [])
  const client = useMemo(
    () =>
      createPreviewWebhookClient({
        webhookUrl: environment.webhookUrl,
        appSecret: environment.appSecret,
        from: environment.customerPhone,
      }),
    [environment],
  )

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Preview do cliente</h1>
        <p className="text-sm text-gray-500">
          Enviando como {environment.customerPhone} — webhook real, assinatura real.
        </p>

        {/* O envio não depende de sessão (vai assinado direto ao webhook), mas LER a conversa
            depende: é a API de admin que devolve o transcript. Sem esse aviso o operador manda
            mensagem, o bot responde, e a tela não muda — parecia envio quebrado. O link navega na
            MESMA aba porque o token fica em `sessionStorage`, que não é compartilhado entre abas. */}
        {!hasAdminSession ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Sem sessão nesta aba: as mensagens são entregues, mas o transcript não carrega.{' '}
            <a href="#/admin" className="underline">
              Entrar no painel nesta aba
            </a>
          </p>
        ) : null}
      </header>

      <ConversationPreview
        client={client}
        sse={conversationsSse}
        conversationId={environment.customerPhone}
        loadMessages={(conversationId) => conversationsApi.fetchMessages(conversationId)}
      />
    </div>
  )
}
