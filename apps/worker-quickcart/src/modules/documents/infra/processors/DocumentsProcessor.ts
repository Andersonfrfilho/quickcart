/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Consome a fila `documents`, enfileirada pelo hook `onMediaReceived` da api-quickcart com o
 * `InboundMediaDescriptor`. Copia a mídia da Meta para o storage e a linka na biblioteca da
 * conversa.
 *
 * Wrapper fino: toda a lógica (idempotência por sourceMediaId, atualização do payload, vínculo do
 * documento) vive no `IngestInboundMediaUseCase` do módulo — o worker só fornece as dependências.
 */

import type { Job } from 'bullmq'
import type { InboundMediaDescriptor } from '@adatechnology/meta-whatsapp-contracts'
import {
  DocumentRepository,
  IngestInboundMediaUseCase,
  PurgeExpiredDocumentsUseCase,
  WhatsAppChannelAdapter,
} from '@adatechnology/meta-whatsapp-module'
import { db } from '@/infra/database/connection'
import { whatsAppProvider } from '@/infra/whatsapp/provider'
import { environment } from '@/infra/config/environment'
import { createWorkerObjectStorage } from '@/modules/documents/infra/storage/objectStorageAdapter'
import { logger } from '@/shared/logger'

const documentsLog = logger.child('Documents')

// Construídos uma vez: o provider de storage abre cliente HTTP no construtor, e refazer isso por
// job desperdiçaria conexão em cima do caminho mais quente da fila.
let ingestUseCase: IngestInboundMediaUseCase | undefined

function resolveIngestUseCase(): IngestInboundMediaUseCase {
  if (ingestUseCase) return ingestUseCase
  if (!whatsAppProvider) throw new Error('whatsapp_provider_not_configured')

  ingestUseCase = new IngestInboundMediaUseCase(
    db as never,
    new WhatsAppChannelAdapter(whatsAppProvider.messages as never),
    createWorkerObjectStorage(),
    new DocumentRepository(db as never),
  )

  return ingestUseCase
}

/** Nome do job repetível de retenção — a mesma fila serve ingestão e limpeza. */
export const PURGE_EXPIRED_JOB = 'purge-expired-documents'

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

async function purgeExpired(): Promise<void> {
  if (environment.DOCUMENTS_RETENTION_DAYS === 0) {
    documentsLog.info('retention_disabled')
    return
  }

  const useCase = new PurgeExpiredDocumentsUseCase(new DocumentRepository(db as never), createWorkerObjectStorage())
  const result = await useCase.execute({
    companyId: COMPANY_ID,
    retentionDays: environment.DOCUMENTS_RETENTION_DAYS,
    batchSize: environment.DOCUMENTS_RETENTION_BATCH_SIZE,
  })

  // `failed` sai no log em vez de derrubar o job: a linha continua no banco, então a próxima
  // varredura tenta de novo. Falhar aqui só encheria a fila de retry sem mudar o resultado.
  documentsLog.info('retention_swept', {
    purged: result.purged,
    failed: result.failed.length,
    retentionDays: environment.DOCUMENTS_RETENTION_DAYS,
  })
}

export async function processDocumentsJob(job: Job<InboundMediaDescriptor>): Promise<void> {
  if (job.name === PURGE_EXPIRED_JOB) {
    await purgeExpired()
    return
  }

  // Desligado, o job é concluído sem efeito em vez de falhar e entrar em retry: storage ausente é
  // configuração, não erro transitório, e insistir só encheria a fila de falhas.
  if (!environment.STORAGE_ENABLED) {
    documentsLog.warn('storage_disabled_skipping', { jobId: job.id, messageId: job.data.messageId })
    return
  }

  const result = await resolveIngestUseCase().execute({
    companyId: job.data.companyId,
    messageId: job.data.messageId,
    sourceMediaId: job.data.sourceMediaId,
    mimeType: job.data.mimeType,
    ...(job.data.filename ? { filename: job.data.filename } : {}),
  })

  documentsLog.info('media_ingested', {
    jobId: job.id,
    messageId: job.data.messageId,
    uploadId: result.uploadId,
    // true quando a mídia já estava no storage — reentrega do job, nada foi baixado de novo.
    alreadyIngested: result.alreadyIngested,
  })
}
