/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ação única por trás de dois gatilhos (spec §3.5, T3.1): o botão "Falar com atendente" do menu
 * (`registerQuickCartFlowActions.ts`) e a palavra-chave global do `GlobalHandler`. Duas
 * implementações do mesmo "pedir gente de verdade" dariam ao cliente dois comportamentos
 * diferentes conforme o caminho — inclusive o de reiniciar a fila de espera duas vezes.
 *
 * NÃO cala o bot: `requestHuman` só marca `humanRequestedAt`, sem tocar em `mode`.
 */

import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'

export type RequestHumanHandoffDependencies = {
  readonly conversationSessionRepository: Pick<ConversationSessionRepositoryInterface, 'findByPhone' | 'requestHuman'>
  readonly whatsAppSender: Pick<WhatsAppSender, 'sendText'>
}

/**
 * Se a conversa já está na fila (ou já em atendimento humano), não reinicia `humanRequestedAt` —
 * isso empurraria quem já esperava para o fim da fila do atendente.
 */
export async function requestHumanHandoff(
  dependencies: RequestHumanHandoffDependencies,
  customerPhone: string,
): Promise<void> {
  const session = await dependencies.conversationSessionRepository.findByPhone(customerPhone)

  if (session?.humanRequestedAt) {
    await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.AGENT_ALREADY_WAITING)
    return
  }

  await dependencies.conversationSessionRepository.requestHuman?.(customerPhone)
  await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.AGENT_REQUESTED)
}
