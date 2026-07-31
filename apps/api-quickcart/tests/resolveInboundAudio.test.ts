/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O que estes testes protegem é a degradação, não o caminho felizardo.
 *
 * A troca de áudio por texto passou a valer para TODOS os caminhos de atendimento, então uma falha
 * aqui não deixa mais um recurso de lado: ela muda o que o cliente recebe em qualquer conversa. O
 * contrato que importa é "nunca devolve menos do que chegou".
 */

import { describe, expect, it } from 'bun:test'
import type { AudioTranscriber } from '@adatechnology/audio-transcription-provider'
import { createInboundAudioResolver } from '@/modules/conversation/application/resolveInboundAudio'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const PHONE = '5511977770001'

const audioMessage: ParsedInboundMessage = {
  kind: 'audio',
  from: PHONE,
  waMessageId: 'wamid.audio.1',
  mediaId: 'media-1',
  mimeType: 'audio/ogg',
}

function transcriberReturning(text: string): AudioTranscriber {
  return {
    transcribe: async () => ({ text, engine: 'groq', language: 'pt' }),
  } as unknown as AudioTranscriber
}

function createDependencies(overrides: Record<string, unknown> = {}) {
  const notices: string[] = []
  return {
    notices,
    dependencies: {
      transcriber: transcriberReturning('Dois quilos de arroz'),
      fetchMediaAsBase64: async () => ({ data: Buffer.from('audio').toString('base64'), mimeType: 'audio/ogg' }),
      sendNotice: async (_to: string, body: string) => {
        notices.push(body)
      },
      ...overrides,
    },
  }
}

describe('createInboundAudioResolver', () => {
  it('entrega áudio como texto para quem atender', async () => {
    const { dependencies } = createDependencies()
    const resolve = createInboundAudioResolver(dependencies as never)

    const resolved = await resolve({ message: audioMessage, whatsappNumber: PHONE })

    expect(resolved.kind).toBe('text')
    // O id da mensagem sobrevive: é por ele que a transcrição é gravada e que o anti-replay funciona.
    expect(resolved.waMessageId).toBe('wamid.audio.1')
    expect(resolved.kind === 'text' && resolved.body).toBe('Dois quilos de arroz')
  })

  it('deixa passar quem não é áudio sem tocar em nada', async () => {
    const { dependencies } = createDependencies()
    const resolve = createInboundAudioResolver(dependencies as never)
    const text: ParsedInboundMessage = { kind: 'text', from: PHONE, waMessageId: 'wamid.text.1', body: 'oi' }

    expect(await resolve({ message: text, whatsappNumber: PHONE })).toBe(text)
  })

  it('devolve o áudio original quando não há transcritor', async () => {
    const { dependencies } = createDependencies({ transcriber: undefined })
    const resolve = createInboundAudioResolver(dependencies as never)

    // Idêntico, não equivalente: quem recebe precisa poder seguir o caminho antigo de áudio.
    expect(await resolve({ message: audioMessage, whatsappNumber: PHONE })).toBe(audioMessage)
  })

  it('devolve o áudio original quando a transcrição falha', async () => {
    const { dependencies } = createDependencies({
      transcriber: {
        transcribe: async () => {
          throw new Error('groq fora do ar')
        },
      },
    })
    const resolve = createInboundAudioResolver(dependencies as never)

    expect(await resolve({ message: audioMessage, whatsappNumber: PHONE })).toBe(audioMessage)
  })

  it('devolve o áudio original quando a transcrição vem vazia', async () => {
    // Silêncio não é resposta: virar texto vazio faria o nó tratar como "respondeu nada".
    const { dependencies } = createDependencies({ transcriber: transcriberReturning('   ') })
    const resolve = createInboundAudioResolver(dependencies as never)

    expect(await resolve({ message: audioMessage, whatsappNumber: PHONE })).toBe(audioMessage)
  })

  it('não avisa "estou escutando" quando a transcrição é rápida', async () => {
    const { dependencies, notices } = createDependencies()
    const resolve = createInboundAudioResolver(dependencies as never)

    await resolve({ message: audioMessage, whatsappNumber: PHONE })

    // Avisar sempre dobraria as mensagens do bot no transcript que o atendente lê depois.
    expect(notices).toEqual([])
  })

  it('grava a transcrição na mensagem pelo waMessageId', async () => {
    const saved: Array<Record<string, unknown>> = []
    const { dependencies } = createDependencies({
      messageRepository: {
        saveTranscriptionByWaMessageId: async (params: Record<string, unknown>) => {
          saved.push(params)
        },
      },
    })
    const resolve = createInboundAudioResolver(dependencies as never)

    await resolve({ message: audioMessage, whatsappNumber: PHONE })

    expect(saved).toHaveLength(1)
    expect(saved[0]?.waMessageId).toBe('wamid.audio.1')
    expect(saved[0]?.text).toBe('Dois quilos de arroz')
  })

  it('entrega o texto mesmo se a gravação da transcrição falhar', async () => {
    const { dependencies } = createDependencies({
      messageRepository: {
        saveTranscriptionByWaMessageId: async () => {
          throw new Error('banco fora')
        },
      },
    })
    const resolve = createInboundAudioResolver(dependencies as never)

    // Perder a conversa por causa de um UPDATE de conveniência seria desproporcional.
    const resolved = await resolve({ message: audioMessage, whatsappNumber: PHONE })
    expect(resolved.kind).toBe('text')
  })
})
