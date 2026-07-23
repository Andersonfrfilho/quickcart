/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória (sem Redis/Graph API reais) — cobre idempotência por
 * mediaId e o caminho sem transcript (Groq indisponível/falha).
 */

import { describe, expect, test } from 'bun:test'
import type { SttProvider, TranscribeAudioParams } from '@/modules/stt/application/providers/SttProvider.interface'
import { ProcessSttJobUseCase } from './ProcessSttJob.use-case'

class FakeIdempotencyGuard {
  private readonly processed = new Set<string>()

  async wasProcessed(mediaId: string): Promise<boolean> {
    return this.processed.has(mediaId)
  }

  async markProcessed(mediaId: string): Promise<void> {
    this.processed.add(mediaId)
  }
}

class FakeMediaFetcher {
  readonly calls: string[] = []

  async fetchMediaAsBase64(mediaId: string): Promise<{ data: string; mimeType: string }> {
    this.calls.push(mediaId)
    return { data: 'base64-audio', mimeType: 'audio/ogg' }
  }
}

class FakeSttProvider implements SttProvider {
  constructor(private readonly transcript: string | undefined) {}

  async transcribe(_params: TranscribeAudioParams): Promise<string | undefined> {
    return this.transcript
  }
}

class FakeResumeConversationClient {
  readonly calls: { sessionId: string; transcript: string | null }[] = []

  async resumeConversation(params: { sessionId: string; transcript: string | null }): Promise<void> {
    this.calls.push(params)
  }
}

function buildUseCase(transcript?: string | undefined) {
  const idempotencyGuard = new FakeIdempotencyGuard()
  const mediaFetcher = new FakeMediaFetcher()
  const sttProvider = new FakeSttProvider(transcript)
  const resumeConversationClient = new FakeResumeConversationClient()

  const useCase = new ProcessSttJobUseCase({ idempotencyGuard, mediaFetcher, sttProvider, resumeConversationClient })

  return { useCase, idempotencyGuard, mediaFetcher, resumeConversationClient }
}

describe('ProcessSttJobUseCase', () => {
  test('transcreve um job novo, devolve o resultado e marca como processado', async () => {
    const { useCase, idempotencyGuard, mediaFetcher, resumeConversationClient } = buildUseCase('2kg arroz, leite')

    await useCase.execute({ jobId: 'job-1', sessionId: 'session-1', mediaId: 'media-1' })

    expect(mediaFetcher.calls).toEqual(['media-1'])
    expect(resumeConversationClient.calls).toEqual([{ sessionId: 'session-1', transcript: '2kg arroz, leite' }])
    expect(await idempotencyGuard.wasProcessed('media-1')).toBe(true)
  })

  test('não reprocessa o mesmo mediaId em uma reentrega do BullMQ', async () => {
    const { useCase, mediaFetcher, resumeConversationClient } = buildUseCase('2kg arroz, leite')

    await useCase.execute({ jobId: 'job-1', sessionId: 'session-1', mediaId: 'media-1' })
    await useCase.execute({ jobId: 'job-1-retry', sessionId: 'session-1', mediaId: 'media-1' })

    expect(mediaFetcher.calls).toEqual(['media-1'])
    expect(resumeConversationClient.calls).toHaveLength(1)
  })

  test('transcript indisponível (sem chave Groq ou falha) devolve null e ainda marca como processado', async () => {
    const { useCase, idempotencyGuard, resumeConversationClient } = buildUseCase(undefined)

    await useCase.execute({ jobId: 'job-2', sessionId: 'session-2', mediaId: 'media-2' })

    expect(resumeConversationClient.calls).toEqual([{ sessionId: 'session-2', transcript: null }])
    expect(await idempotencyGuard.wasProcessed('media-2')).toBe(true)
  })
})
