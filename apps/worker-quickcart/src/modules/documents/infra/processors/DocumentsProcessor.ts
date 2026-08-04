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
  MessageRepository,
  PurgeExpiredDocumentsUseCase,
  SettingsRepository,
  TranscribeAudioUseCase,
  WhatsAppChannelAdapter,
  createTranscriptionPolicyResolver,
  type TranscriptionPolicyResolver,
} from '@adatechnology/meta-whatsapp-module'
import { db } from '@/infra/database/connection'
import { whatsAppProvider } from '@/infra/whatsapp/provider'
import { environment } from '@/infra/config/environment'
import { createWorkerObjectStorage } from '@/modules/documents/infra/storage/objectStorageAdapter'
import { resolveTranscriber } from '@/infra/transcription/transcriberAdapter'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'

const documentsLog = logger.child('Documents')

// Construídos uma vez: o provider de storage abre cliente HTTP no construtor, e refazer isso por
// job desperdiçaria conexão em cima do caminho mais quente da fila.
let ingestUseCase: IngestInboundMediaUseCase | undefined
let transcribeUseCase: TranscribeAudioUseCase | undefined | null
let policyResolver: TranscriptionPolicyResolver | undefined

/**
 * Política por empresa, com o ambiente do worker como padrão.
 *
 * Resolvida a cada áudio, não capturada na construção: o worker é um processo longo, e um valor
 * congelado faria o lojista mexer no interruptor do painel e nada mudar até o próximo deploy.
 */
function resolvePolicyResolver(): TranscriptionPolicyResolver {
  policyResolver ??= createTranscriptionPolicyResolver({
    settingsRepository: new SettingsRepository(db as never),
    defaults: {
      // Só chegamos aqui com a transcrição ligada no ambiente; explicitar mantém a leitura honesta.
      isEnabled: environment.TRANSCRIPTION_ENABLED,
      mode: environment.TRANSCRIPTION_MODE,
    },
  })
  return policyResolver
}

function resolveIngestUseCase(): IngestInboundMediaUseCase {
  if (ingestUseCase) return ingestUseCase
  if (!whatsAppProvider) throw new Error('whatsapp_provider_not_configured')

  const transcriber = resolveTranscriber()

  ingestUseCase = new IngestInboundMediaUseCase(
    db as never,
    new WhatsAppChannelAdapter(whatsAppProvider.messages as never),
    createWorkerObjectStorage(),
    new DocumentRepository(db as never),
    // Sem transcritor, a ingestão se comporta como antes do recurso existir. Com ele em modo
    // `auto`, transcreve o buffer que acabou de baixar — sem um segundo download do storage.
    //
    // O hook fica de fora aqui de propósito: quem reenfileira é a api-quickcart, que é dona da fila.
    // O worker apenas grava o status `pending`, e o job de retomada resolve depois. Duplicar o
    // enfileiramento nos dois lados criaria dois jobs para o mesmo áudio.
    transcriber
      ? {
          transcriber,
          resolvePolicy: resolvePolicyResolver(),
          messageRepository: new MessageRepository(db as never),
          languageHint: environment.TRANSCRIPTION_LANGUAGE,
        }
      : undefined,
  )

  return ingestUseCase
}

/**
 * `null` quando a capacidade não existe — memoizado para não reconstruir por job.
 *
 * Distingue "ainda não resolvido" (`undefined`) de "resolvido e ausente" (`null`): sem isso, cada
 * job com transcrição desligada tentaria montar o use-case de novo.
 */
function resolveTranscribeUseCase(): TranscribeAudioUseCase | null {
  if (transcribeUseCase !== undefined) return transcribeUseCase

  const transcriber = resolveTranscriber()
  if (!transcriber) {
    transcribeUseCase = null
    return null
  }

  transcribeUseCase = new TranscribeAudioUseCase({
    messageRepository: new MessageRepository(db as never),
    objectStorage: createWorkerObjectStorage(),
    transcriber,
    // Retomada de pendente também respeita o interruptor: se a empresa desligou a transcrição entre
    // o enfileiramento e a execução, o job não deve gastar cota contra a decisão nova.
    resolvePolicy: resolvePolicyResolver(),
    languageHint: environment.TRANSCRIPTION_LANGUAGE,
  })

  return transcribeUseCase
}

/** Nome do job repetível de retenção — a mesma fila serve ingestão, limpeza e transcrição. */
export const PURGE_EXPIRED_JOB = 'purge-expired-documents'

/**
 * Retomada de transcrição que ficou `pending` (cota estourada, falha transitória). Enfileirado pela
 * api-quickcart no hook `onTranscriptionDeferred`, com o atraso do `Retry-After`.
 *
 * A string precisa casar com `DOCUMENTS_JOBS.TRANSCRIBE_AUDIO` da api-quickcart — processos
 * independentes, sem pacote compartilhado entre eles.
 */
export const TRANSCRIBE_AUDIO_JOB = 'transcribe-audio'

type TranscribeAudioJobData = {
  readonly companyId: string
  readonly messageId: string
}

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

/**
 * Retoma uma transcrição pendente.
 *
 * Falha retriável do engine PROPAGA aqui, ao contrário do modo automático: este job existe só para
 * transcrever, então deixar o erro subir é exatamente o que faz o BullMQ tentar de novo com backoff
 * — e é essa retentativa que fecha a rede de segurança do rate limit.
 */
async function transcribeAudio(job: Job<TranscribeAudioJobData>): Promise<void> {
  const useCase = resolveTranscribeUseCase()
  if (!useCase) {
    // Configuração, não erro transitório: concluir sem efeito em vez de encher a fila de retry.
    documentsLog.warn(LOG_EVENTS.TRANSCRIPTION_UNAVAILABLE, { jobId: job.id, messageId: job.data.messageId })
    return
  }

  const result = await useCase.execute({ companyId: job.data.companyId, messageId: job.data.messageId })

  documentsLog.info(LOG_EVENTS.TRANSCRIPTION_JOB_PROCESSED, {
    jobId: job.id,
    messageId: job.data.messageId,
    status: result.status,
    engine: result.engine,
    // true quando devolveu o texto já salvo sem gastar cota — reentrega do job.
    alreadyTranscribed: result.alreadyTranscribed,
  })
}

export async function processDocumentsJob(job: Job<InboundMediaDescriptor>): Promise<void> {
  if (job.name === PURGE_EXPIRED_JOB) {
    await purgeExpired()
    return
  }

  if (job.name === TRANSCRIBE_AUDIO_JOB) {
    await transcribeAudio(job as unknown as Job<TranscribeAudioJobData>)
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
    // Ausente quando não é áudio, ou quando o modo é sob demanda.
    ...(result.transcription ? { transcriptionStatus: result.transcription.status } : {}),
  })
}
