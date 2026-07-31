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
  // Ciclo de vida do servidor
  SERVER_STARTING: 'server_starting',
  SERVER_READY: 'server_ready',
  SERVER_FAILED: 'server_failed',
  SERVER_SHUTTING_DOWN: 'server_shutting_down',
  SERVER_SHUTDOWN_TIMEOUT: 'server_shutdown_timeout',
  SERVER_SHUTDOWN_ERROR: 'server_shutdown_error',
  SERVER_SHUTDOWN_COMPLETE: 'server_shutdown_complete',

  // HTTP
  REQUEST: 'request',
  RESPONSE_OK: 'response_ok',
  RESPONSE_ERROR: 'response_error',
  RESPONSE_UNHANDLED: 'response_unhandled',

  // Webhook Meta (WhatsApp)
  WEBHOOK_VERIFY_START: 'webhook_verify_start',
  WEBHOOK_VERIFY_OK: 'webhook_verify_ok',
  WEBHOOK_VERIFY_FAILED: 'webhook_verify_failed',
  WEBHOOK_RECEIVED: 'webhook_received',
  WEBHOOK_INVALID_SIGNATURE: 'webhook_invalid_signature',
  WEBHOOK_DUPLICATE_IGNORED: 'webhook_duplicate_ignored',
  WEBHOOK_PROCESSED: 'webhook_processed',
  WEBHOOK_PROCESSING_ERROR: 'webhook_processing_error',

  // WhatsApp sender
  WHATSAPP_SEND_MOCK: 'whatsapp_send_mock',
  WHATSAPP_SEND_FAILED: 'whatsapp_send_failed',

  // Motor de conversa
  CONVERSATION_ENGINE_FAILED: 'conversation_engine_failed',
  CONVERSATION_CUSTOMER_NOT_FOUND: 'conversation_customer_not_found',
  CONVERSATION_LIST_REFINE_NON_OK: 'conversation_list_refine_non_ok',
  CONVERSATION_LIST_REFINE_FAILED: 'conversation_list_refine_failed',

  // Resume de conversa (rota interna, chamada pelo worker após STT)
  CONVERSATION_RESUME_SESSION_NOT_FOUND: 'conversation_resume_session_not_found',
  CONVERSATION_RESUME_PROCESSED: 'conversation_resume_processed',

  // STT (fila)
  STT_ENQUEUE_FAILED: 'stt_enqueue_failed',

  // Transcrição de nota de voz (@adatechnology/audio-transcription-provider)
  TRANSCRIPTION_DISABLED_NO_KEY: 'transcription_disabled_no_key',
  // Engine principal falhou e a cadeia caiu para o reserva — degradação não pode ser silenciosa.
  TRANSCRIPTION_ENGINE_DEGRADED: 'transcription_engine_degraded',
  // Cota estourada ou falha transitória: o áudio ficou 'pending' e voltou para a fila.
  TRANSCRIPTION_DEFERRED: 'transcription_deferred',
  TRANSCRIPTION_DEFER_ENQUEUE_FAILED: 'transcription_defer_enqueue_failed',
} as const

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS]
