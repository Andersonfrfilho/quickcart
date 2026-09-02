/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O `user-module` só publica as rotas de redefinição de senha quando recebe um driver de e-mail
 * (`hasPasswordReset`). O QuickCart não tinha nenhum plugado — `isEmailFeatureEnabled` existia em
 * `environment.ts` sem um único consumidor. Este é o driver, e ele só existe quando o SMTP está
 * configurado: sem servidor de e-mail não há reset a oferecer, e a rota não sobe.
 */

import { createTransport } from 'nodemailer'
import type { EmailDriverPort, SendEmailParams, DeliveryAttemptResult } from '@adatechnology/user-contracts'

import { environment, isEmailFeatureEnabled } from '@/infra/config/environment'

const DRIVER_NAME = 'smtp'
const UNKNOWN_SMTP_ERROR_CODE = 'smtp_unknown'

function resolveSmtpErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === 'string') return code
  }
  return UNKNOWN_SMTP_ERROR_CODE
}

export function createSmtpEmailDriver(): EmailDriverPort | undefined {
  if (!isEmailFeatureEnabled()) return undefined

  const transport = createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_PORT === 465,
    auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASS },
  })

  return {
    driver: DRIVER_NAME,
    async send(params: SendEmailParams): Promise<DeliveryAttemptResult> {
      try {
        const sent = await transport.sendMail({
          from: environment.MAIL_FROM ?? environment.SMTP_USER,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo,
        })

        return { outcome: 'sent', providerMessageId: sent.messageId }
      } catch (error) {
        // O contrato modela a falha no retorno, não na exceção: quem chama decide reenviar.
        return { outcome: 'retriable', errorCode: resolveSmtpErrorCode(error) }
      }
    },
  }
}
