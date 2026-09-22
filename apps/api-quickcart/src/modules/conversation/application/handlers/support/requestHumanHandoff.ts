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
 *
 * Cooldown por telefone (B3): em modo bot, um segundo pedido dentro de 10 minutos só confirma que
 * a equipe já sabe, sem reenfileirar — senão o cliente martelando "atendente" gera um alerta por
 * mensagem. `SET NX` com TTL no Redis; a chave leva o hash do telefone, não o número. Redis fora
 * do ar é fail-open: o pedido segue como antes, só com um `warn`.
 */

import { createHash } from 'node:crypto'

import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import {
  HUMAN_HANDOFF_COOLDOWN_KEY_PREFIX,
  HUMAN_HANDOFF_COOLDOWN_SECONDS,
  HUMAN_HANDOFF_COOLDOWN_STORE_FAILED_LOG_EVENT,
} from '@/modules/conversation/shared/HumanHandoff.constant'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const handoffLog = logger.child('HumanHandoff')

export type RequestHumanHandoffDependencies = {
  readonly conversationSessionRepository: Pick<ConversationSessionRepositoryInterface, 'findByPhone' | 'requestHuman'>
  readonly whatsAppSender: Pick<WhatsAppSender, 'sendText'>
  readonly cacheProvider: Pick<CacheProvider, 'setIfNotExists'>
}

function buildCooldownKey(customerPhone: string): string {
  const phoneHash = createHash('sha256').update(customerPhone).digest('hex')
  return `${HUMAN_HANDOFF_COOLDOWN_KEY_PREFIX}:${phoneHash}`
}

/** `true` quando este é o primeiro pedido da janela. Falha do Redis conta como primeiro (fail-open). */
async function claimCooldown(
  cacheProvider: RequestHumanHandoffDependencies['cacheProvider'],
  customerPhone: string,
): Promise<boolean> {
  try {
    return await cacheProvider.setIfNotExists(buildCooldownKey(customerPhone), '1', HUMAN_HANDOFF_COOLDOWN_SECONDS)
  } catch (error) {
    handoffLog.warn(HUMAN_HANDOFF_COOLDOWN_STORE_FAILED_LOG_EVENT, { error: serializeError(error) })
    return true
  }
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

  const isFirstRequestInWindow = await claimCooldown(dependencies.cacheProvider, customerPhone)
  if (!isFirstRequestInWindow) {
    await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.AGENT_ALREADY_NOTIFIED)
    return
  }

  await dependencies.conversationSessionRepository.requestHuman(customerPhone)
  await dependencies.whatsAppSender.sendText(customerPhone, MESSAGES.AGENT_REQUESTED)
}
