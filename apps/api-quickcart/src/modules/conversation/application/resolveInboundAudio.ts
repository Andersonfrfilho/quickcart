/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Troca nota de voz por texto na entrada, antes de qualquer roteamento.
 *
 * Havia três lugares transcrevendo áudio no produto: o grafo (síncrono, para decidir o próximo nó),
 * o handler de lista (por fila, com o worker devolvendo pelo `ResumeConversation`) e o modo
 * automático do módulo (só para o histórico da inbox). Nenhum dos três cobria o resto: o
 * `BrowseHandler` responde `"escolha uma opção da lista acima"` a qualquer coisa que não seja toque
 * em item de lista, então o cliente que ditava a compra ouvia burocracia.
 *
 * Resolvendo aqui, quem atende recebe `kind: 'text'` e não precisa saber que houve áudio — e passar
 * a entender voz num caminho novo deixa de ser uma tarefa que alguém pode esquecer.
 *
 * Falha e silêncio devolvem a mensagem ORIGINAL, de propósito: o comportamento de quem recebe áudio
 * hoje continua valendo (o handler de lista, por exemplo, ainda enfileira), então uma transcrição
 * indisponível degrada em vez de quebrar.
 */

import type { AudioTranscriber } from '@adatechnology/audio-transcription-provider'
import type { MessageRepository } from '@adatechnology/meta-whatsapp-module'
import { TRANSCRIPTION_STATUS } from '@adatechnology/meta-whatsapp-module'
import { environment } from '@/infra/config/environment'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const audioLog = logger.child('InboundAudio')

/**
 * Aviso de "estou escutando" só depois desta espera.
 *
 * Groq turbo mais a busca da mídia na Meta fica em 2-3s, e silêncio curto no WhatsApp não assusta
 * ninguém. Avisar sempre dobraria as mensagens do bot no transcript que o atendente lê depois.
 */
const NOTICE_AFTER_MS = 2_000

export type InboundAudioResolverDependencies = {
  /**
   * Ausente = a capacidade não existe, e áudio segue cru para quem sabe lidar com ele.
   *
   * Injetado, e não construído aqui, pelo mesmo motivo dos outros providers: chave e liga/desliga são
   * do ambiente do produto.
   */
  readonly transcriber?: AudioTranscriber | undefined
  readonly fetchMediaAsBase64: (mediaId: string) => Promise<{ readonly data: string; readonly mimeType: string }>
  /**
   * Manda o aviso de espera. Recebe função, e não o canal, porque o aviso precisa entrar no
   * transcript — quem monta o canal com log é o wiring, que já faz isso para o grafo.
   */
  readonly sendNotice: (whatsappNumber: string, body: string) => Promise<void>
  /** ISO 639-1 do produto. Informar corta a detecção de idioma do engine. */
  readonly languageHint?: string | undefined
  /**
   * Guarda a transcrição na mensagem que o módulo acabou de persistir.
   *
   * Ausente, a transcrição fica efêmera: funciona, mas o painel mostra o áudio sem texto e o modo
   * automático do módulo paga uma segunda chamada pelo mesmo conteúdo.
   */
  readonly messageRepository?: MessageRepository | undefined
}

export type ResolveInboundAudioParams = {
  readonly message: ParsedInboundMessage
  readonly whatsappNumber: string
}

export type ResolveInboundAudio = (params: ResolveInboundAudioParams) => Promise<ParsedInboundMessage>

export function createInboundAudioResolver(dependencies: InboundAudioResolverDependencies): ResolveInboundAudio {
  async function persistTranscription(
    waMessageId: string,
    engine: string,
    language: string | undefined,
    text: string,
  ): Promise<void> {
    const { messageRepository } = dependencies
    if (!messageRepository) return

    try {
      await messageRepository.saveTranscriptionByWaMessageId({
        companyId: environment.WHATSAPP_COMPANY_ID,
        // Endereça por `waMessageId` porque é o único id que o webhook conhece.
        waMessageId,
        status: TRANSCRIPTION_STATUS.DONE,
        text,
        engine,
        language: language ?? null,
      })
    } catch (error: unknown) {
      // Perder a conversa por causa de um UPDATE de conveniência seria desproporcional: o cliente já
      // vai receber a resposta certa, e o pior caso é o painel transcrever de novo depois.
      audioLog.warn('transcription_not_persisted', { error: serializeError(error) })
    }
  }

  return async function resolveInboundAudio({
    message,
    whatsappNumber,
  }: ResolveInboundAudioParams): Promise<ParsedInboundMessage> {
    const { transcriber } = dependencies
    if (message.kind !== 'audio' || !transcriber) return message

    const notice = setTimeout(() => {
      void dependencies
        .sendNotice(whatsappNumber, MESSAGES.AUDIO_PROCESSING)
        .catch((error: unknown) => audioLog.warn('notice_failed', { error: serializeError(error) }))
    }, NOTICE_AFTER_MS)

    try {
      const media = await dependencies.fetchMediaAsBase64(message.mediaId)
      const result = await transcriber.transcribe({
        buffer: Buffer.from(media.data, 'base64'),
        mimeType: media.mimeType || message.mimeType,
        ...(dependencies.languageHint ? { languageHint: dependencies.languageHint } : {}),
      })

      const text = result.text.trim()
      audioLog.info('transcribed', { engine: result.engine, chars: text.length })

      if (text.length === 0) return message

      await persistTranscription(message.waMessageId, result.engine, result.language, text)

      return { kind: 'text', from: message.from, waMessageId: message.waMessageId, body: text }
    } catch (error: unknown) {
      audioLog.warn('transcription_failed', { error: serializeError(error) })
      return message
    } finally {
      clearTimeout(notice)
    }
  }
}
