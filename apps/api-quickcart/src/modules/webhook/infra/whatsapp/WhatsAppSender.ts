/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Sem WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID configurados (dev local sem
 * app da Meta), opera em modo mock: loga a mensagem e devolve um waMessageId falso,
 * mantendo o transcript funcional para testar o motor de conversa sem credenciais.
 */

import {
  createWhatsAppProvider,
  WhatsAppConfigError,
  WhatsAppConnectionError,
  WhatsAppTimeoutError,
  type InteractiveButton,
  type InteractiveListSection,
  type SendMessageResult,
  type WhatsAppProvider,
} from '@adatechnology/whatsapp-provider'
import { environment } from '@/infra/config/environment'
import { generateId } from '@/shared/id'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import {
  WhatsAppConfigMissingError,
  WhatsAppError,
  WhatsAppNetworkError,
  WhatsAppSendError,
} from '@/shared/errors/WhatsAppErrors'
import type { MessageRepositoryInterface } from '@/modules/webhook/domain/MessageRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import { serializeError } from '@/shared/serializeError'

const senderLog = logger.child('WhatsAppSender')

function isWhatsAppConfigured(): boolean {
  return Boolean(environment.WHATSAPP_ACCESS_TOKEN && environment.WHATSAPP_PHONE_NUMBER_ID)
}

function buildProvider(): WhatsAppProvider | undefined {
  if (!isWhatsAppConfigured()) return undefined

  return createWhatsAppProvider({
    accessToken: environment.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: environment.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: environment.WHATSAPP_API_VERSION,
    baseUrl: environment.WHATSAPP_BASE_URL,
  })
}

function mapProviderError(error: unknown): WhatsAppError {
  if (error instanceof WhatsAppConfigError) return new WhatsAppConfigMissingError(error.message)
  if (error instanceof WhatsAppConnectionError || error instanceof WhatsAppTimeoutError) {
    return new WhatsAppNetworkError(error.message, error)
  }
  if (error instanceof Error) return new WhatsAppSendError(error.message, error)
  return new WhatsAppSendError('Erro desconhecido ao enviar mensagem via WhatsApp.')
}

type WhatsAppSenderDependencies = {
  readonly messageRepository: MessageRepositoryInterface
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
}

type PersistOutboundParams = {
  readonly to: string
  readonly type: string
  readonly body?: string | undefined
  readonly payload?: unknown
  readonly waMessageId: string | null
}

type SendViaProviderResult = {
  readonly waMessageId: string | null
  readonly mocked: boolean
}

export class WhatsAppSender {
  private readonly provider: WhatsAppProvider | undefined = buildProvider()

  constructor(private readonly dependencies: WhatsAppSenderDependencies) {}

  async sendText(to: string, body: string): Promise<void> {
    const { waMessageId, mocked } = await this.sendViaProvider('text', to, (provider) =>
      provider.messages.sendText(to, body),
    )
    if (mocked) senderLog.info(LOG_EVENTS.WHATSAPP_SEND_MOCK, { to, type: 'text', body })
    await this.persistOutbound({ to, type: 'text', body, waMessageId })
  }

  async sendInteractiveButtons(to: string, bodyText: string, buttons: readonly InteractiveButton[]): Promise<void> {
    const { waMessageId, mocked } = await this.sendViaProvider('interactive_buttons', to, (provider) =>
      provider.messages.sendInteractiveButtons({ to, bodyText, buttons }),
    )
    if (mocked) senderLog.info(LOG_EVENTS.WHATSAPP_SEND_MOCK, { to, type: 'interactive_buttons', bodyText })
    await this.persistOutbound({ to, type: 'interactive_buttons', body: bodyText, payload: { buttons }, waMessageId })
  }

  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: readonly InteractiveListSection[],
  ): Promise<void> {
    const { waMessageId, mocked } = await this.sendViaProvider('interactive_list', to, (provider) =>
      provider.messages.sendInteractiveList({ to, bodyText, buttonText, sections }),
    )
    if (mocked) senderLog.info(LOG_EVENTS.WHATSAPP_SEND_MOCK, { to, type: 'interactive_list', bodyText })
    await this.persistOutbound({
      to,
      type: 'interactive_list',
      body: bodyText,
      payload: { buttonText, sections },
      waMessageId,
    })
  }

  private async sendViaProvider(
    type: string,
    to: string,
    send: (provider: WhatsAppProvider) => Promise<SendMessageResult>,
  ): Promise<SendViaProviderResult> {
    if (!this.provider) {
      return { waMessageId: `mock-${generateId()}`, mocked: true }
    }

    try {
      const result = await send(this.provider)
      return { waMessageId: result.waMessageId, mocked: false }
    } catch (error) {
      senderLog.error(LOG_EVENTS.WHATSAPP_SEND_FAILED, {
        to,
        type,
        message: serializeError(error),
      })
      throw mapProviderError(error)
    }
  }

  private async persistOutbound(params: PersistOutboundParams): Promise<void> {
    const session = await this.dependencies.conversationSessionRepository.touchByPhone({ customerPhone: params.to })
    await this.dependencies.messageRepository.create({
      id: generateId(),
      sessionId: session.id,
      direction: 'outbound',
      waMessageId: params.waMessageId ?? undefined,
      type: params.type,
      body: params.body,
      payload: params.payload,
    })
  }
}
