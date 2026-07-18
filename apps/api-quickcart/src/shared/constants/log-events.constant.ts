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
} as const

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS]
