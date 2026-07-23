/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória (sem Postgres/Redis reais) — cobre idempotência,
 * upsert de customer/sessão e atualização de status de mensagens outbound.
 */

import { describe, expect, test } from 'bun:test'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type {
  CustomerRepositoryInterface,
  UpdateContactInfoParams,
  UpsertCustomerByPhoneParams,
} from '@/modules/webhook/domain/CustomerRepository.interface'
import type {
  ConversationSessionRepositoryInterface,
  TouchConversationSessionByPhoneParams,
  UpdateConversationSessionStateByPhoneParams,
} from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type {
  CreateMessageRecordParams,
  MessageRepositoryInterface,
} from '@/modules/webhook/domain/MessageRepository.interface'
import type { Customer, ConversationSession, Message } from '@/infra/database/schema'
import type {
  ParsedInboundMessage,
  WhatsAppWebhookPayload,
} from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import type { ConversationEngine } from '@/modules/conversation/application/ConversationEngine'
import { ReceiveWhatsAppWebhookUseCase } from './ReceiveWhatsAppWebhook.use-case'

class FakeCacheProvider implements CacheProvider {
  private readonly store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async setIfNotExists(key: string, value: string): Promise<boolean> {
    if (this.store.has(key)) return false
    this.store.set(key, value)
    return true
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key)
  }
}

class FakeCustomerRepository implements CustomerRepositoryInterface {
  readonly upsertCalls: UpsertCustomerByPhoneParams[] = []

  async findById(): Promise<Customer | undefined> {
    return undefined
  }

  async findByPhone(): Promise<Customer | undefined> {
    return undefined
  }

  async upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer> {
    this.upsertCalls.push(params)
    return {
      id: 'customer-1',
      phone: params.phone,
      name: params.name ?? null,
      email: null,
      defaultAddress: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async updateContactInfo(params: UpdateContactInfoParams): Promise<Customer> {
    return {
      id: params.customerId,
      phone: '',
      name: null,
      email: params.email ?? null,
      defaultAddress: params.defaultAddress ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
}

class FakeConversationSessionRepository implements ConversationSessionRepositoryInterface {
  readonly touchCalls: TouchConversationSessionByPhoneParams[] = []

  async findById(): Promise<ConversationSession | undefined> {
    return undefined
  }

  async findByPhone(): Promise<ConversationSession | undefined> {
    return undefined
  }

  async findOrCreateByPhone(customerPhone: string): Promise<ConversationSession> {
    return this.touchByPhone({ customerPhone })
  }

  async touchByPhone(params: TouchConversationSessionByPhoneParams): Promise<ConversationSession> {
    this.touchCalls.push(params)
    return {
      id: 'session-1',
      customerPhone: params.customerPhone,
      currentState: 'greeting',
      context: {},
      mode: 'bot',
      lastInteractionAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async updateStateByPhone(params: UpdateConversationSessionStateByPhoneParams): Promise<ConversationSession> {
    return {
      id: 'session-1',
      customerPhone: params.customerPhone,
      currentState: params.currentState,
      context: params.context,
      mode: 'bot',
      lastInteractionAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
}

class FakeMessageRepository implements MessageRepositoryInterface {
  readonly createCalls: CreateMessageRecordParams[] = []
  readonly statusUpdateCalls: { waMessageId: string; status: string }[] = []

  async create(params: CreateMessageRecordParams): Promise<Message> {
    this.createCalls.push(params)
    return {
      id: params.id,
      sessionId: params.sessionId,
      direction: params.direction,
      waMessageId: params.waMessageId ?? null,
      type: params.type,
      body: params.body ?? null,
      payload: params.payload ?? null,
      status: params.status ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async updateStatusByWaMessageId(waMessageId: string, status: string): Promise<Message | undefined> {
    this.statusUpdateCalls.push({ waMessageId, status })
    return undefined
  }
}

class FakeConversationEngine {
  readonly handleCalls: ParsedInboundMessage[] = []

  async handle(message: ParsedInboundMessage): Promise<void> {
    this.handleCalls.push(message)
  }
}

function buildTextMessagePayload(waMessageId: string, from = '5511999999999'): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              messages: [
                {
                  id: waMessageId,
                  from,
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: '2kg arroz, leite' },
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

function buildUseCase() {
  const cacheProvider = new FakeCacheProvider()
  const customerRepository = new FakeCustomerRepository()
  const conversationSessionRepository = new FakeConversationSessionRepository()
  const messageRepository = new FakeMessageRepository()
  const conversationEngine = new FakeConversationEngine()

  const useCase = new ReceiveWhatsAppWebhookUseCase({
    cacheProvider,
    customerRepository,
    conversationSessionRepository,
    messageRepository,
    conversationEngine: conversationEngine as unknown as ConversationEngine,
  })

  return { useCase, cacheProvider, customerRepository, conversationSessionRepository, messageRepository, conversationEngine }
}

describe('ReceiveWhatsAppWebhookUseCase', () => {
  test('processa uma mensagem de texto nova: upsert de customer, sessão e transcript', async () => {
    const { useCase, customerRepository, conversationSessionRepository, messageRepository } = buildUseCase()
    const payload = buildTextMessagePayload('wamid.1')

    const result = await useCase.execute({ payload })

    expect(result).toEqual({ processedCount: 1, duplicateCount: 0, statusUpdateCount: 0 })
    expect(customerRepository.upsertCalls).toEqual([{ phone: '5511999999999' }])
    expect(conversationSessionRepository.touchCalls).toEqual([{ customerPhone: '5511999999999' }])
    expect(messageRepository.createCalls).toHaveLength(1)
    expect(messageRepository.createCalls[0]?.body).toBe('2kg arroz, leite')
    expect(messageRepository.createCalls[0]?.direction).toBe('inbound')
  })

  test('ignora mensagem duplicada (mesmo waMessageId reentregue pela Meta)', async () => {
    const { useCase, messageRepository } = buildUseCase()
    const payload = buildTextMessagePayload('wamid.duplicate')

    const firstResult = await useCase.execute({ payload })
    const secondResult = await useCase.execute({ payload })

    expect(firstResult).toEqual({ processedCount: 1, duplicateCount: 0, statusUpdateCount: 0 })
    expect(secondResult).toEqual({ processedCount: 0, duplicateCount: 1, statusUpdateCount: 0 })
    expect(messageRepository.createCalls).toHaveLength(1)
  })

  test('processa status de entrega atualizando a mensagem outbound correspondente', async () => {
    const { useCase, messageRepository } = buildUseCase()
    const payload: WhatsAppWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                statuses: [{ id: 'wamid.out.1', status: 'delivered', timestamp: '1700000001', recipient_id: '5511999999999' }],
              },
            },
          ],
        },
      ],
    }

    const result = await useCase.execute({ payload })

    expect(result).toEqual({ processedCount: 0, duplicateCount: 0, statusUpdateCount: 1 })
    expect(messageRepository.statusUpdateCalls).toEqual([{ waMessageId: 'wamid.out.1', status: 'delivered' }])
  })
})
