/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Transcrição opcional via Groq (Whisper large-v3-turbo). Assim como o
 * GroqListRefinerProvider da api-quickcart, qualquer falha (timeout, resposta
 * não-2xx, corpo inválido) devolve undefined em vez de lançar — quem chama decide
 * o fallback (pedir a lista por texto). Envia o áudio recebido do WhatsApp direto,
 * sem conversão de formato (Whisper aceita ogg/opus nativamente).
 */

import { environment } from '@/infra/config/environment'
import type { SttProvider, TranscribeAudioParams } from '@/modules/stt/application/providers/SttProvider.interface'
import { GROQ_TRANSCRIBE_LANGUAGE, GROQ_TRANSCRIBE_TIMEOUT_MS, GROQ_TRANSCRIPTIONS_URL, GROQ_WHISPER_MODEL } from '@/shared/Groq.constant'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const sttLog = logger.child('GroqSttProvider')

const AUDIO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
}

function resolveAudioFilename(mimeType: string): string {
  const baseMimeType = mimeType.split(';')[0]?.trim() ?? mimeType
  const extension = AUDIO_EXTENSION_BY_MIME_TYPE[baseMimeType] ?? 'ogg'
  return `audio.${extension}`
}

export class GroqSttProvider implements SttProvider {
  async transcribe(params: TranscribeAudioParams): Promise<string | undefined> {
    if (!environment.GROQ_API_KEY) return undefined

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), GROQ_TRANSCRIBE_TIMEOUT_MS)

    try {
      const audioBuffer = Buffer.from(params.audioBase64, 'base64')
      const formData = new FormData()
      formData.append('file', new Blob([audioBuffer], { type: params.mimeType }), resolveAudioFilename(params.mimeType))
      formData.append('model', GROQ_WHISPER_MODEL)
      formData.append('language', GROQ_TRANSCRIBE_LANGUAGE)
      formData.append('response_format', 'json')

      const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${environment.GROQ_API_KEY}` },
        body: formData,
        signal: abortController.signal,
      })

      if (!response.ok) {
        sttLog.warn(LOG_EVENTS.STT_TRANSCRIBE_NON_OK, { status: response.status })
        return undefined
      }

      const payload = (await response.json()) as { text?: string }
      const transcript = payload.text?.trim()
      return transcript && transcript.length > 0 ? transcript : undefined
    } catch (error) {
      sttLog.warn(LOG_EVENTS.STT_TRANSCRIBE_FAILED, {
        error: serializeError(error),
      })
      return undefined
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
