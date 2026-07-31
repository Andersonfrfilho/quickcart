/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Envolve o canal para que tudo que o bot manda apareça no transcript do atendente.
 *
 * Mensagem que o cliente viu e o painel não mostra é pior que mensagem nenhuma: o atendente assume a
 * conversa sem saber o que já foi dito e repete (ou contradiz) o bot. Por isso o log fica no envio, e
 * não na disciplina de quem chama.
 *
 * Vive fora do `FlowDriver` porque o grafo deixou de ser o único a mandar mensagem fora de um
 * handler — a resolução de áudio na entrada também avisa o cliente que está escutando.
 */

import type { ChannelAdapterInterface } from '@adatechnology/meta-whatsapp-contracts'
import type { LogMessageUseCase } from '@adatechnology/meta-whatsapp-module'

export type WrapChannelWithLoggingParams = {
  readonly channel: ChannelAdapterInterface
  readonly logMessage: LogMessageUseCase
  readonly companyId: string
  readonly whatsappNumber: string
  readonly startState: string
}

export function wrapChannelWithLogging(params: WrapChannelWithLoggingParams): ChannelAdapterInterface {
  const { channel, logMessage, companyId, whatsappNumber, startState } = params

  const log = async (
    type: string,
    content: string | null,
    sent: { readonly externalMessageId: string | null },
  ): Promise<void> => {
    await logMessage.execute({
      companyId,
      whatsappNumber,
      direction: 'outbound',
      sender: 'bot',
      type,
      content,
      waMessageId: sent.externalMessageId,
      status: 'sent',
      startState,
    })
  }

  return {
    sendText: async (to, body) => {
      const sent = await channel.sendText(to, body)
      await log('text', body, sent)
      return sent
    },
    sendMedia: async (mediaParams) => {
      const sent = await channel.sendMedia(mediaParams)
      await log('media', mediaParams.caption ?? mediaParams.filename, sent)
      return sent
    },
    sendTemplate: async (templateParams) => {
      const sent = await channel.sendTemplate(templateParams)
      await log('template', templateParams.templateName, sent)
      return sent
    },
    sendInteractiveList: async (listParams) => {
      const sent = await channel.sendInteractiveList(listParams)
      await log('interactive_list', listParams.body, sent)
      return sent
    },
    // Leitura não gera mensagem para ninguém: passa direto.
    fetchMediaAsBase64: (mediaId) => channel.fetchMediaAsBase64(mediaId),
  }
}
