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
 *
 * Deduplicação por `mode`, não por `humanRequestedAt` (correção pós-T3.1): o
 * `@adatechnology/meta-whatsapp-module` nunca limpa `humanRequestedAt` — nem `release` nem
 * `takeover` tocam nesse campo, só em `mode`/`assignedUserId` (`SessionRepository.setMode`,
 * `dist/index.js`). Deduplicar pelo timestamp fazia o PRIMEIRO pedido de atendente da vida de um
 * cliente bloquear todo pedido futuro, mesmo semanas depois com a conversa já devolvida ao bot.
 * `mode` é o dado que realmente muda no takeover/release, então é ele que decide se já existe
 * atendente na conversa.
 */

import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'

export type RequestHumanHandoffDependencies = {
  readonly conversationSessionRepository: Pick<ConversationSessionRepositoryInterface, 'findByPhone' | 'requestHuman'>
  readonly whatsAppSender: Pick<WhatsAppSender, 'sendText'>
}

/**
 * Se um atendente já assumiu a conversa (`mode === 'human'`), só avisa — não chama `requestHuman`
 * de novo. Em qualquer outro caso (bot, com ou sem pedido anterior já resolvido) chama
 * `requestHuman` sempre: ele grava `humanRequestedAt = now()` e (re)coloca a conversa na fila.
 */
export async function requestHumanHandoff(
  dependencies: RequestHumanHandoffDependencies,
  customerPhone: string,
): Promise<void> {
  const session = await dependencies.conversationSessionRepository.findByPhone(customerPhone)

  if (session?.mode === 'human') {
    await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.AGENT_HUMAN_IN_PROGRESS)
    return
  }

  await dependencies.conversationSessionRepository.requestHuman(customerPhone)
  await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.AGENT_REQUESTED)
}
