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
} as const

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS]
