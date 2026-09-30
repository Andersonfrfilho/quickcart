/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A Meta reenvia o webhook até receber 200 — por isso, uma vez validada a assinatura HMAC,
 * qualquer erro de processamento é logado e engolido aqui, nunca propagado, para não disparar
 * reentregas infinitas de um evento que já falhou.
 *
 * Verificação, assinatura, anti-replay e persistência vivem no @adatechnology/meta-whatsapp-module;
 * este controller só traduz HTTP.
 */

import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import { InvalidWebhookSignatureError } from '@adatechnology/meta-whatsapp-contracts'
import type { RouteHandler } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { WhatsAppInvalidSignatureError } from '@/shared/errors/WhatsAppErrors'
import { serializeError } from '@/shared/serializeError'

const webhookLog = logger.child('Webhook')

type WebhookControllerDependencies = {
  readonly metaWhatsApp: MetaWhatsAppModule
}

export class WebhookController {
  constructor(private readonly dependencies: WebhookControllerDependencies) {}

  handleVerify: RouteHandler = (request, response) => {
    const mode = request.query.get('hub.mode')

    webhookLog.info(LOG_EVENTS.WEBHOOK_VERIFY_START, { mode })

    try {
      const challenge = this.dependencies.metaWhatsApp.webhook.verifyChallenge({
        mode,
        token: request.query.get('hub.verify_token'),
        challenge: request.query.get('hub.challenge'),
      })

      webhookLog.info(LOG_EVENTS.WEBHOOK_VERIFY_OK, {})
      response.text(200, challenge)
    } catch (error) {
      if (!(error instanceof InvalidWebhookSignatureError)) throw error

      webhookLog.info(LOG_EVENTS.WEBHOOK_VERIFY_FAILED, { mode })
      response.text(403, 'Forbidden')
    }
  }

  handleReceive: RouteHandler = async (request, response) => {
    webhookLog.info(LOG_EVENTS.WEBHOOK_RECEIVED, {})

    try {
      const result = await this.dependencies.metaWhatsApp.webhook.receive.execute({
        companyId: environment.WHATSAPP_COMPANY_ID,
        rawBody: request.rawBody,
        signatureHeader: request.headers['x-hub-signature-256'],
      })

      if (result.duplicate) {
        webhookLog.info(LOG_EVENTS.WEBHOOK_DUPLICATE_IGNORED, {})
      } else {
        webhookLog.info(LOG_EVENTS.WEBHOOK_PROCESSED, {
          messages: result.messagesProcessed,
          statuses: result.statusesProcessed,
        })
      }
    } catch (error) {
      // Assinatura inválida é a única falha que não vira 200: a chamada não veio da Meta, então
      // não há reentrega a evitar e o chamador precisa ver a recusa.
      if (error instanceof InvalidWebhookSignatureError) {
        webhookLog.info(LOG_EVENTS.WEBHOOK_INVALID_SIGNATURE, {})
        throw new WhatsAppInvalidSignatureError()
      }

      webhookLog.error(LOG_EVENTS.WEBHOOK_PROCESSING_ERROR, { message: serializeError(error) })
    }

    response.json(200, { data: { status: 'ok' } })
  }
}
