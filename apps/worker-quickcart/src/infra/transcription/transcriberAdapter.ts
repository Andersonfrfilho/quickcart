/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Espelha o adapter da api-quickcart: processos separados, mesmas variáveis. O worker é quem
 * efetivamente transcreve no modo `auto` (é ele que baixa o áudio da Meta), então sem isto aqui o
 * modo automático não sairia do papel por mais que a api estivesse configurada.
 */

import { createGroqTranscriber, createTranscriberChain } from '@adatechnology/audio-transcription-provider'
import type { AudioTranscriber } from '@adatechnology/audio-transcription-provider'
import { environment } from '@/infra/config/environment'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const transcriptionLog = logger.child('Transcription')

let cachedTranscriber: AudioTranscriber | undefined
let wasResolved = false

/**
 * `undefined` quando desligado ou sem chave — a ingestão então grava as colunas nulas ("não
 * avaliado") em vez de fingir que tentou.
 *
 * Memoizado porque é consultado por job, e revalidar configuração a cada áudio é trabalho repetido
 * no caminho mais quente da fila.
 */
export function resolveTranscriber(): AudioTranscriber | undefined {
  if (wasResolved) return cachedTranscriber
  wasResolved = true

  if (!environment.TRANSCRIPTION_ENABLED) return undefined

  if (!environment.TRANSCRIPTION_GROQ_API_KEY) {
    transcriptionLog.warn(LOG_EVENTS.TRANSCRIPTION_DISABLED_NO_KEY)
    return undefined
  }

  const groq = createGroqTranscriber({
    apiKey: environment.TRANSCRIPTION_GROQ_API_KEY,
    model: environment.TRANSCRIPTION_MODEL,
    languageHint: environment.TRANSCRIPTION_LANGUAGE,
  })

  cachedTranscriber = environment.TRANSCRIPTION_LOCAL_FALLBACK_ENABLED
    ? createTranscriberChain([groq, createLocalTranscriber()], {
        onEngineFailure: (error, details) => {
          transcriptionLog.warn(LOG_EVENTS.TRANSCRIPTION_ENGINE_DEGRADED, {
            engine: details.engine,
            isLast: details.isLast,
            error: serializeError(error),
          })
        },
      })
    : groq

  return cachedTranscriber
}

/**
 * Import dinâmico por exigência do pacote: o subpath `/whisper-local` carrega
 * `node:child_process` e pressupõe ffmpeg e whisper.cpp na imagem. Importar no topo arrastaria essa
 * bagagem para o worker mesmo com o reserva desligado — que é o caso padrão.
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
