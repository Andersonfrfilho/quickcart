/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const QUEUE_NAMES = {
  STT: 'stt',
  RECEIPT: 'receipt',
  /** Fila do ProcessNotificationJob antigo. Nada novo entra aqui. */
  NOTIFICATION: 'notification',
  /** Entregas do notification-module. Nome novo porque o formato do job é outro. */
  NOTIFICATION_DELIVERY: 'notification-delivery',
  // Mídia recebida do cliente aguardando cópia da Meta para o storage do host.
  DOCUMENTS: 'documents',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

/**
 * Jobs da fila `documents`. A mesma fila serve ingestão de mídia, retenção e retomada de
 * transcrição — é todo trabalho sobre o mesmo binário, e uma fila a mais só multiplicaria conexão
 * Redis sem separar nada de verdade.
 *
 * Repetido no worker (que processa) por serem processos independentes, sem pacote compartilhado
 * entre eles: os dois lados precisam concordar nestas strings.
 */
export const DOCUMENTS_JOBS = {
  INGEST_INBOUND_MEDIA: 'ingest-inbound-media',
  PURGE_EXPIRED: 'purge-expired-documents',
  TRANSCRIBE_AUDIO: 'transcribe-audio',
} as const

/**
 * Atraso do reenfileiramento quando o engine não informou `Retry-After`.
 *
 * Cinco minutos: a cota do Groq é medida em segundos de áudio por HORA, então tentar de novo em
 * segundos apenas queimaria a retentativa contra o mesmo teto ainda fechado.
 */
export const DEFAULT_TRANSCRIPTION_RETRY_SECONDS = 300
