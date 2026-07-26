/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Message } from '@/modules/webhook/domain/Conversation.types'

// `customerPhone` acompanha o sessionId porque a tabela do meta-whatsapp-module desnormaliza o
// número na mensagem (é assim que ela lista uma conversa sem join). O `id` saiu: quem o gera
// agora é o default da coluna, e mandar um id de fora só criaria duas fontes para a mesma chave.
export type CreateMessageRecordParams = {
  readonly sessionId: string
  readonly customerPhone: string
  readonly direction: 'inbound' | 'outbound'
  readonly waMessageId?: string | undefined
  readonly type: string
  readonly body?: string | undefined
  readonly payload?: unknown
  readonly status?: string | undefined
}

export interface MessageRepositoryInterface {
  // undefined quando a mensagem já existia — a gravação é idempotente por (empresa, waMessageId).
  create(params: CreateMessageRecordParams): Promise<Message | undefined>
  updateStatusByWaMessageId(waMessageId: string, status: string): Promise<Message | undefined>
}
