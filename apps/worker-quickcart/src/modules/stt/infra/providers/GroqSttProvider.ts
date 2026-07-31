/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * STT efêmero: transcreve a nota de voz só para o motor de conversa agir, sem persistir nada. O
 * multipart e a tabela de mime→extensão vivem em @adatechnology/audio-transcription-provider, o
 * mesmo pacote da transcrição persistida da inbox — aqui só traduzimos para o contrato SttProvider.
 *
 * A tradução é engolir a exceção: qualquer falha vira `undefined`, e quem chama resume a conversa
 * com transcript null (ver ProcessSttJob.use-case). O pacote distingue retriável de definitivo, o
 * que este caminho não tem como aproveitar — a fila `stt` já reentrega pelo BullMQ e o usuário está
 * esperando resposta —, então a distinção fica no log, onde serve a diagnóstico.
 */

import {
  createGroqTranscriber,
  isRetriableTranscriptionFailure,
} from '@adatechnology/audio-transcription-provider'
import type { AudioTranscriber } from '@adatechnology/audio-transcription-provider'
import { environment } from '@/infra/config/environment'
import type { SttProvider, TranscribeAudioParams } from '@/modules/stt/application/providers/SttProvider.interface'
import { GROQ_TRANSCRIBE_LANGUAGE, GROQ_TRANSCRIBE_TIMEOUT_MS, GROQ_WHISPER_MODEL } from '@/shared/Groq.constant'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const sttLog = logger.child('GroqSttProvider')

export class GroqSttProvider implements SttProvider {
  private readonly transcriber: AudioTranscriber | undefined

  constructor() {
    this.transcriber = environment.GROQ_API_KEY
      ? createGroqTranscriber({
          apiKey: environment.GROQ_API_KEY,
          model: GROQ_WHISPER_MODEL,
          languageHint: GROQ_TRANSCRIBE_LANGUAGE,
          // Bem abaixo do padrão do pacote: aqui tem alguém esperando a resposta no WhatsApp, e um
          // minuto de espera já não serve mais à conversa.
          timeoutMs: GROQ_TRANSCRIBE_TIMEOUT_MS,
        })
      : undefined
  }

  async transcribe(params: TranscribeAudioParams): Promise<string | undefined> {
    if (!this.transcriber) {
      sttLog.warn(LOG_EVENTS.STT_TRANSCRIBE_SKIPPED_NO_KEY)
      return undefined
    }

    try {
      const result = await this.transcriber.transcribe({
        buffer: Buffer.from(params.audioBase64, 'base64'),
        mimeType: params.mimeType,
      })

      return result.text.length > 0 ? result.text : undefined
    } catch (error) {
      sttLog.warn(LOG_EVENTS.STT_TRANSCRIBE_FAILED, {
        mimeType: params.mimeType,
        isRetriable: isRetriableTranscriptionFailure(error),
        error: serializeError(error),
      })
      return undefined
    }
  }
}
