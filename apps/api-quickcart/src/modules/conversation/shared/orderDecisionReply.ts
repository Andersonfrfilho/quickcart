/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A leitura de "isto é resposta sobre item em falta?", num lugar só (ADR 0003).
 *
 * Dois lugares fazem a mesma pergunta por motivos diferentes: o webhook, para NÃO mandar a resposta
 * para o grafo, e o `GlobalHandler`, para atendê-la. Em dois parses, o webhook passaria adiante um
 * toque que o handler depois reconheceria — e a resposta do cliente viraria a saudação do grafo.
 */

import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { parseOrderDecisionButtonId, type ParsedOrderDecision } from '@/modules/conversation/shared/orderDecisionButton'

/** `undefined` = não é resposta de decisão de pedido, e quem chamou segue o caminho normal. */
export function parseOrderDecisionReply(message: ParsedInboundMessage): ParsedOrderDecision | undefined {
  if (message.kind === 'button_reply') return parseOrderDecisionButtonId(message.buttonId)
  if (message.kind === 'list_reply') return parseOrderDecisionButtonId(message.listId)
  return undefined
}
