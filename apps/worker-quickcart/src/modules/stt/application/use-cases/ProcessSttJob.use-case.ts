/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Idempotência chaveada no mediaId do WhatsApp (estável entre reentregas do mesmo job pelo
 * BullMQ) — ver JobIdempotencyGuard. A marca só é gravada depois do resumeConversation ter
 * sucesso, nunca antes: uma falha transitória não pode fazer o job parecer "já processado".
 */

import type { SttProvider } from '@/modules/stt/application/providers/SttProvider.interface'
import type { ProcessSttJobParams } from '@/modules/stt/application/types/ProcessSttJob.types'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'

export type SttIdempotencyGuard = {
  readonly wasProcessed: (mediaId: string) => Promise<boolean>
  readonly markProcessed: (mediaId: string) => Promise<void>
}

export type MediaFetcher = {
  readonly fetchMediaAsBase64: (mediaId: string) => Promise<{ readonly data: string; readonly mimeType: string }>
}

export type ResumeConversationClient = {
  readonly resumeConversation: (params: { readonly sessionId: string; readonly transcript: string | null }) => Promise<void>
}

type ProcessSttJobUseCaseDependencies = {
  readonly idempotencyGuard: SttIdempotencyGuard
  readonly mediaFetcher: MediaFetcher
  readonly sttProvider: SttProvider
  readonly resumeConversationClient: ResumeConversationClient
}

const sttProcessorLog = logger.child('SttProcessor')

export class ProcessSttJobUseCase {
  constructor(private readonly dependencies: ProcessSttJobUseCaseDependencies) {}

  async execute(params: ProcessSttJobParams): Promise<void> {
    const { jobId, sessionId, mediaId } = params

    const alreadyProcessed = await this.dependencies.idempotencyGuard.wasProcessed(mediaId)
    if (alreadyProcessed) {
      sttProcessorLog.info(LOG_EVENTS.STT_JOB_PROCESSED, { jobId, sessionId, mediaId, alreadyProcessed: true })
      return
    }

    const media = await this.dependencies.mediaFetcher.fetchMediaAsBase64(mediaId)
    const transcript = await this.dependencies.sttProvider.transcribe({ audioBase64: media.data, mimeType: media.mimeType })

    await this.dependencies.resumeConversationClient.resumeConversation({ sessionId, transcript: transcript ?? null })
    await this.dependencies.idempotencyGuard.markProcessed(mediaId)

    sttProcessorLog.info(LOG_EVENTS.STT_JOB_PROCESSED, { jobId, sessionId, mediaId, transcribed: Boolean(transcript) })
  }
}
