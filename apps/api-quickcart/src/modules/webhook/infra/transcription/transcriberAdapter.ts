/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Monta o transcritor de áudio a partir do ambiente validado, para injetar no
 * meta-whatsapp-module. Quem lê `process.env` é este arquivo (via `environment`), nunca o pacote —
 * mesmo contrato do storage e do moderador.
 *
 * A cadeia existe para o dia em que o free tier do Groq apertar: ligar
 * TRANSCRIPTION_LOCAL_FALLBACK_ENABLED acrescenta o engine local ao fim da fila sem tocar em
 * módulo, migration ou UI. Enquanto está desligado, a imagem não carrega ffmpeg nem modelo.
 */

import { createGroqTranscriber, createTranscriberChain } from '@adatechnology/audio-transcription-provider'
import type { AudioTranscriber } from '@adatechnology/audio-transcription-provider'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { serializeError } from '@/shared/serializeError'

const transcriptionLog = logger.child('Transcription')

/**
 * `undefined` quando desligado ou sem chave — a ausência fica visível no tipo do provider, e o
 * módulo grava as colunas nulas ("não avaliado") em vez de fingir que tentou.
 *
 * Construído uma vez: o cliente não abre conexão, mas revalidar configuração por áudio é trabalho
 * repetido no caminho quente da ingestão.
 */
export function createQuickCartTranscriber(): AudioTranscriber | undefined {
  if (!environment.TRANSCRIPTION_ENABLED) return undefined

  if (!environment.TRANSCRIPTION_GROQ_API_KEY) {
    // Ligado sem chave é erro de configuração, e silenciar faria a inbox parecer quebrada sem pista.
    transcriptionLog.warn(LOG_EVENTS.TRANSCRIPTION_DISABLED_NO_KEY)
    return undefined
  }

  const groq = createGroqTranscriber({
    apiKey: environment.TRANSCRIPTION_GROQ_API_KEY,
    model: environment.TRANSCRIPTION_MODEL,
    languageHint: environment.TRANSCRIPTION_LANGUAGE,
  })

  if (!environment.TRANSCRIPTION_LOCAL_FALLBACK_ENABLED) return groq

  return createTranscriberChain([groq, createLocalTranscriber()], {
    // Cair para o reserva não pode ser silencioso: tudo continua "funcionando" e ninguém descobre
    // que o engine principal está fora há uma semana.
    onEngineFailure: (error, details) => {
      transcriptionLog.warn(LOG_EVENTS.TRANSCRIPTION_ENGINE_DEGRADED, {
        engine: details.engine,
        isLast: details.isLast,
        error: serializeError(error),
      })
    },
  })
}

/**
 * Import dinâmico por exigência do próprio pacote: o subpath `/whisper-local` carrega
 * `node:child_process` e pressupõe ffmpeg e whisper.cpp na imagem. Importar no topo arrastaria essa
 * bagagem para todo processo que só usa o engine hospedado.
 */
function createLocalTranscriber(): AudioTranscriber {
  const modelPath = environment.TRANSCRIPTION_LOCAL_MODEL_PATH

  return {
    name: 'whisper-local',
    transcribe: async (input) => {
      const { createWhisperLocalTranscriber } = await import(
        '@adatechnology/audio-transcription-provider/whisper-local'
      )
      return createWhisperLocalTranscriber({
        modelPath,
        languageHint: environment.TRANSCRIPTION_LANGUAGE,
      }).transcribe(input)
    },
  }
}
