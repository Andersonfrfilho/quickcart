/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Leitura do transcript para o simulador de cliente, sem sessão de administrador.
 *
 * Existe porque o simulador vivia num impasse: ele ENTREGA a mensagem assinando com o app secret,
 * mas para MOSTRAR a conversa de volta usava a API de admin — e o token de admin fica em
 * `sessionStorage`, que é por aba. Na aba do simulador não havia sessão, o transcript nunca
 * carregava, e o sintoma era "mandei e não aconteceu nada".
 *
 * A guarda é uma só, e é do servidor: `PREVIEW_TRANSCRIPT_ENABLED`, que não é definido em staging
 * nem em produção. Sem a flag responde 404 — não 403 —, para não anunciar que existe.
 *
 * Antes havia também um HMAC do app secret, e ele foi removido de propósito. Para assinar, a aba do
 * cliente precisava do app secret no bundle (`VITE_*` é literal inlinado), ou seja, o segredo ia
 * para qualquer um que baixasse a página — e quem baixa a página consegue produzir a assinatura.
 * A trava não protegia nada e custava o segredo: era só teatro. O app secret agora existe
 * exclusivamente no servidor.
 */

import type { RouteHandler } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'
import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import { toMessagePayload } from './Conversation.controller'

const TRANSCRIPT_LIMIT = 100
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } }

export function createPreviewTranscriptController(metaWhatsApp: MetaWhatsAppModule) {
  const handleListMessages: RouteHandler = async (request, response) => {
    if (!environment.PREVIEW_TRANSCRIPT_ENABLED) {
      response.json(404, NOT_FOUND)
      return
    }

    const number = request.params[0] ?? ''

    const messages = await metaWhatsApp.conversations.listMessages.execute({
      companyId: environment.WHATSAPP_COMPANY_ID,
      whatsappNumber: number,
      limit: TRANSCRIPT_LIMIT,
    })

    // MESMO mapeamento da rota de admin, e não a linha crua: além de `sentAt` (sem ele a bolha
    // mostra NaN:NaN), a linha traz `companyId`, `sessionId`, `agentUserId` e os termos de moderação
    // — dado interno que não deve sair por uma rota que não passa pelo token de admin.
    response.json(200, { data: messages.map(toMessagePayload) })
  }

  return { handleListMessages }
}
