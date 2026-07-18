/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Erros de integração com a Meta Cloud API (usados a partir da Fase 3).
 */

import { DomainError } from '@/shared/errors/DomainError'
import {
  WHATSAPP_CONFIG_MISSING,
  WHATSAPP_INVALID_SIGNATURE,
  WHATSAPP_SEND_ERROR,
  WHATSAPP_NETWORK_ERROR,
} from '@/shared/errors/codes'

const WHATSAPP_DOMAIN = 'whatsapp'

export class WhatsAppError extends DomainError {
  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message, statusCode, code, WHATSAPP_DOMAIN, details)
    this.name = 'WhatsAppError'
  }
}

export class WhatsAppConfigMissingError extends WhatsAppError {
  constructor(message = 'WhatsApp não configurado. Verifique WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN.') {
    super(message, 503, WHATSAPP_CONFIG_MISSING)
  }
}

export class WhatsAppInvalidSignatureError extends WhatsAppError {
  constructor() {
    super('Assinatura do webhook inválida.', 401, WHATSAPP_INVALID_SIGNATURE)
  }
}

export class WhatsAppSendError extends WhatsAppError {
  constructor(message: string, public readonly originalError?: Error) {
    super(message, 502, WHATSAPP_SEND_ERROR, { originalMessage: originalError?.message })
  }
}

export class WhatsAppNetworkError extends WhatsAppError {
  constructor(message: string, public readonly originalError?: Error) {
    super(message, 502, WHATSAPP_NETWORK_ERROR, { originalMessage: originalError?.message })
  }
}
