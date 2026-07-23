/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const LOG_EVENTS = {
  // Ciclo de vida do processo
  STARTUP_COMPLETE: 'startup_complete',
  STARTUP_FAILED: 'startup_failed',
  SHUTTING_DOWN: 'shutting_down',
  SHUTDOWN_TIMEOUT: 'shutdown_timeout',
  SHUTDOWN_COMPLETE: 'shutdown_complete',

  // STT (Groq Whisper)
  STT_TRANSCRIBE_SKIPPED_NO_KEY: 'stt_transcribe_skipped_no_key',
  STT_TRANSCRIBE_NON_OK: 'stt_transcribe_non_ok',
  STT_TRANSCRIBE_FAILED: 'stt_transcribe_failed',
  STT_JOB_PROCESSED: 'stt_job_processed',
  STT_JOB_FAILED: 'stt_job_failed',

  // Notificação
  NOTIFICATION_JOB_PROCESSED: 'notification_job_processed',
  NOTIFICATION_JOB_FAILED: 'notification_job_failed',

  // Recibo
  RECEIPT_JOB_PROCESSED: 'receipt_job_processed',
  RECEIPT_JOB_FAILED: 'receipt_job_failed',
  RECEIPT_FISCAL_EMIT_FAILED: 'receipt_fiscal_emit_failed',
} as const

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS]
