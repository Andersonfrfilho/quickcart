/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Comparações timing-safe: nunca usar === em segredos, para não vazar tempo de
 * resposta que ajude um atacante a adivinhar a assinatura/token byte a byte.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

function timingSafeStringEqual(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf-8')
  const receivedBuffer = Buffer.from(received, 'utf-8')

  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export type VerifyWebhookSignatureParams = {
  readonly rawBody: Buffer
  readonly signatureHeader: string | undefined
  readonly appSecret: string
}

export function verifyWebhookSignature(params: VerifyWebhookSignatureParams): boolean {
  const { rawBody, signatureHeader, appSecret } = params
  if (!signatureHeader || !appSecret) return false

  const [algorithm, receivedHex] = signatureHeader.split('=')
  if (algorithm !== 'sha256' || !receivedHex) return false

  const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return timingSafeStringEqual(expectedHex, receivedHex)
}

export type VerifyWebhookTokenParams = {
  readonly receivedToken: string | null
  readonly expectedToken: string
}

export function verifyWebhookVerifyToken(params: VerifyWebhookTokenParams): boolean {
  const { receivedToken, expectedToken } = params
  if (!receivedToken) return false

  return timingSafeStringEqual(expectedToken, receivedToken)
}
