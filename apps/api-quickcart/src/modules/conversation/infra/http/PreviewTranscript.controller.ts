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
 * Três guardas, porque isto lê conversa de cliente:
 *
 * 1. **Desligado por padrão.** Só existe com `PREVIEW_TRANSCRIPT_ENABLED=true`, que não é definido
 *    em staging nem em produção. Sem a flag responde 404 — não 403 —, para não anunciar que existe.
 * 2. **Assinado com HMAC do app secret**, o mesmo que o webhook valida. Não é segredo em query
 *    string: vai em header, e a comparação é de tempo constante.
 * 3. **A assinatura cobre o número pedido**, então uma assinatura capturada não serve para ler outra
 *    conversa.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { RouteHandler } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'
import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import { toMessagePayload } from './Conversation.controller'

const PREVIEW_SIGNATURE_HEADER = 'x-preview-signature'
const TRANSCRIPT_LIMIT = 100
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } }

function expectedSignature(payload: string, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`
}

function signatureMatches(received: string | undefined, expected: string): boolean {
  if (!received) return false
  const receivedBytes = Buffer.from(received)
  const expectedBytes = Buffer.from(expected)
  // Comprimentos diferentes fariam `timingSafeEqual` lançar — e o próprio lançamento vazaria a
  // diferença de tamanho.
  if (receivedBytes.length !== expectedBytes.length) return false
  return timingSafeEqual(receivedBytes, expectedBytes)
}

export function createPreviewTranscriptController(metaWhatsApp: MetaWhatsAppModule) {
  const handleListMessages: RouteHandler = async (request, response) => {
    const appSecret = environment.WHATSAPP_APP_SECRET
    if (!environment.PREVIEW_TRANSCRIPT_ENABLED || !appSecret) {
      response.json(404, NOT_FOUND)
      return
    }

    const number = request.params[0] ?? ''
    const signature = request.headers[PREVIEW_SIGNATURE_HEADER]
    if (!signatureMatches(signature, expectedSignature(number, appSecret))) {
      // 404 outra vez: para quem não tem a assinatura, a rota é indistinguível de inexistente.
      response.json(404, NOT_FOUND)
      return
    }

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
