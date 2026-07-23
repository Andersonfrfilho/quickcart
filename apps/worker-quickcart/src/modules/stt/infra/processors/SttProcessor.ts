/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Consome a fila `stt` enfileirada por ListHandler.ts (api-quickcart) com
 * { sessionId, mediaId }. Busca o áudio na Graph API, tenta transcrever e devolve o
 * resultado para o motor de conversa via /v1/internal/conversation/resume. transcript
 * null (sem chave Groq, falha ou mídia sem áudio) faz a api-quickcart responder com
 * AUDIO_NOT_SUPPORTED_YET — não é um erro do processor, então o job é concluído normalmente.
 *
 * Wrapper fino do BullMQ — a lógica testável vive em ProcessSttJob.use-case.ts.
 */

import type { Job } from 'bullmq'
import { resumeConversation } from '@/infra/api/InternalApiClient'
import { whatsAppProvider } from '@/infra/whatsapp/provider'
import { markSttJobProcessed, wasSttJobProcessed } from '@/modules/stt/infra/idempotency/SttIdempotencyGuard'
import { sttProvider } from '@/modules/stt/infra/providers/createSttProvider'
import { ProcessSttJobUseCase } from '@/modules/stt/application/use-cases/ProcessSttJob.use-case'

export type SttJobData = {
  readonly sessionId: string
  readonly mediaId: string
}

export async function processSttJob(job: Job<SttJobData>): Promise<void> {
  if (!whatsAppProvider) {
    throw new Error('whatsapp_provider_not_configured')
  }

  const useCase = new ProcessSttJobUseCase({
    idempotencyGuard: { wasProcessed: wasSttJobProcessed, markProcessed: markSttJobProcessed },
    mediaFetcher: whatsAppProvider.messages,
    sttProvider,
    resumeConversationClient: { resumeConversation },
  })

  await useCase.execute({ jobId: job.id, sessionId: job.data.sessionId, mediaId: job.data.mediaId })
}
