/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A Meta reenvia o webhook até receber 200 — por isso, uma vez que a assinatura HMAC
 * é validada, qualquer erro de processamento é logado e engolido aqui, nunca propagado,
 * para não disparar reentregas infinitas de um evento que já falhou.
 */

import type { RouteHandler } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { WhatsAppInvalidSignatureError } from '@/shared/errors/WhatsAppErrors'
import { verifyWebhookSignature, verifyWebhookVerifyToken } from '@/modules/webhook/infra/security/WebhookSignature'
import type { ReceiveWhatsAppWebhookUseCase } from '@/modules/webhook/application/use-cases/ReceiveWhatsAppWebhook.use-case'
import type { WhatsAppWebhookPayload } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { serializeError } from '@/shared/serializeError'

const webhookLog = logger.child('Webhook')

type WebhookControllerDependencies = {
  readonly receiveWhatsAppWebhookUseCase: ReceiveWhatsAppWebhookUseCase
}

export class WebhookController {
  constructor(private readonly dependencies: WebhookControllerDependencies) {}

  handleVerify: RouteHandler = (request, response) => {
    const mode = request.query.get('hub.mode')
    const challenge = request.query.get('hub.challenge')
    const receivedToken = request.query.get('hub.verify_token')

    webhookLog.info(LOG_EVENTS.WEBHOOK_VERIFY_START, { mode })

    const isTokenValid = verifyWebhookVerifyToken({
      receivedToken,
      expectedToken: environment.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    })

    if (mode !== 'subscribe' || challenge === null || !isTokenValid) {
      webhookLog.info(LOG_EVENTS.WEBHOOK_VERIFY_FAILED, { mode })
      response.text(403, 'Forbidden')
      return
    }

    webhookLog.info(LOG_EVENTS.WEBHOOK_VERIFY_OK, {})
    response.text(200, challenge)
  }

  handleReceive: RouteHandler = async (request, response) => {
    const isSignatureValid = verifyWebhookSignature({
      rawBody: request.rawBody,
      signatureHeader: request.headers['x-hub-signature-256'],
      appSecret: environment.WHATSAPP_APP_SECRET,
    })

    if (!isSignatureValid) {
      webhookLog.info(LOG_EVENTS.WEBHOOK_INVALID_SIGNATURE, {})
      throw new WhatsAppInvalidSignatureError()
    }

    webhookLog.info(LOG_EVENTS.WEBHOOK_RECEIVED, {})

    try {
      const payload = request.body as WhatsAppWebhookPayload
      await this.dependencies.receiveWhatsAppWebhookUseCase.execute({ payload })
    } catch (error) {
      webhookLog.error(LOG_EVENTS.WEBHOOK_PROCESSING_ERROR, {
        message: serializeError(error),
      })
    }

    response.json(200, { data: { status: 'ok' } })
  }
}
