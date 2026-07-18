/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Idempotência via Redis (wa:msg:{id}, TTL 3600s) evita reprocessar reentregas do
 * mesmo evento — a Meta reenvia webhooks quando não recebe 200 a tempo.
 */

import { generateId } from '@/shared/id'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { MessageRepositoryInterface } from '@/modules/webhook/domain/MessageRepository.interface'
import { parseInboundMessage } from '@/modules/webhook/application/parseInboundMessage'
import type { WhatsAppWebhookMessage, WhatsAppWebhookStatus } from '../types/WhatsAppWebhookPayload.types'
import type { ReceiveWhatsAppWebhookParams, ReceiveWhatsAppWebhookResult } from '../types/ReceiveWhatsAppWebhook.types'

const MESSAGE_IDEMPOTENCY_TTL_SECONDS = 3600
const MESSAGE_IDEMPOTENCY_KEY_PREFIX = 'wa:msg:'

const webhookLog = logger.child('Webhook')

type ReceiveWhatsAppWebhookUseCaseDependencies = {
  readonly cacheProvider: CacheProvider
  readonly customerRepository: CustomerRepositoryInterface
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly messageRepository: MessageRepositoryInterface
}

export class ReceiveWhatsAppWebhookUseCase {
  constructor(private readonly dependencies: ReceiveWhatsAppWebhookUseCaseDependencies) {}

  async execute(params: ReceiveWhatsAppWebhookParams): Promise<ReceiveWhatsAppWebhookResult> {
    const changes = params.payload.entry?.flatMap((entry) => entry.changes ?? []) ?? []
    const messages = changes.flatMap((change) => change.value?.messages ?? [])
    const statuses = changes.flatMap((change) => change.value?.statuses ?? [])

    const messageResults = await Promise.all(messages.map((message) => this.processMessage(message)))
    await Promise.all(statuses.map((status) => this.processStatus(status)))

    return {
      processedCount: messageResults.filter((wasProcessed) => wasProcessed).length,
      duplicateCount: messageResults.filter((wasProcessed) => !wasProcessed).length,
      statusUpdateCount: statuses.length,
    }
  }

  private async processMessage(message: WhatsAppWebhookMessage): Promise<boolean> {
    const idempotencyKey = `${MESSAGE_IDEMPOTENCY_KEY_PREFIX}${message.id}`
    const alreadyProcessed = await this.dependencies.cacheProvider.exists(idempotencyKey)

    if (alreadyProcessed) {
      webhookLog.info(LOG_EVENTS.WEBHOOK_DUPLICATE_IGNORED, { waMessageId: message.id })
      return false
    }

    await this.dependencies.cacheProvider.set(idempotencyKey, '1', MESSAGE_IDEMPOTENCY_TTL_SECONDS)

    const parsed = parseInboundMessage(message)

    await this.dependencies.customerRepository.upsertByPhone({ phone: parsed.from })
    const session = await this.dependencies.conversationSessionRepository.touchByPhone({
      customerPhone: parsed.from,
    })

    await this.dependencies.messageRepository.create({
      id: generateId(),
      sessionId: session.id,
      direction: 'inbound',
      waMessageId: parsed.waMessageId,
      type: message.type,
      body: parsed.kind === 'text' ? parsed.body : undefined,
      payload: parsed.kind === 'text' ? undefined : parsed,
    })

    webhookLog.info(LOG_EVENTS.WEBHOOK_PROCESSED, { waMessageId: message.id, kind: parsed.kind })
    return true
  }

  private async processStatus(status: WhatsAppWebhookStatus): Promise<void> {
    await this.dependencies.messageRepository.updateStatusByWaMessageId(status.id, status.status)
  }
}
