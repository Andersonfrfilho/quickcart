/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { verifyWebhookSignature, verifyWebhookVerifyToken } from './WebhookSignature'

const APP_SECRET = 'test-app-secret'

function signBody(rawBody: Buffer, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
}

describe('verifyWebhookSignature', () => {
  test('aceita assinatura HMAC válida', () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }))
    const signatureHeader = signBody(rawBody, APP_SECRET)

    expect(verifyWebhookSignature({ rawBody, signatureHeader, appSecret: APP_SECRET })).toBe(true)
  })

  test('rejeita assinatura HMAC inválida (corpo alterado)', () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }))
    const signatureHeader = signBody(rawBody, APP_SECRET)
    const tamperedBody = Buffer.from(JSON.stringify({ hello: 'tampered' }))

    expect(verifyWebhookSignature({ rawBody: tamperedBody, signatureHeader, appSecret: APP_SECRET })).toBe(false)
  })

  test('rejeita quando o segredo usado para assinar é diferente', () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }))
    const signatureHeader = signBody(rawBody, 'outro-segredo')

    expect(verifyWebhookSignature({ rawBody, signatureHeader, appSecret: APP_SECRET })).toBe(false)
  })

  test('rejeita quando o header de assinatura está ausente', () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }))

    expect(verifyWebhookSignature({ rawBody, signatureHeader: undefined, appSecret: APP_SECRET })).toBe(false)
  })

  test('rejeita quando o appSecret está vazio (não configurado)', () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }))
    const signatureHeader = signBody(rawBody, '')

    expect(verifyWebhookSignature({ rawBody, signatureHeader, appSecret: '' })).toBe(false)
  })

  test('rejeita algoritmo diferente de sha256', () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }))
    const signatureHeader = `sha1=${createHmac('sha1', APP_SECRET).update(rawBody).digest('hex')}`

    expect(verifyWebhookSignature({ rawBody, signatureHeader, appSecret: APP_SECRET })).toBe(false)
  })
})

describe('verifyWebhookVerifyToken', () => {
  test('aceita quando o token recebido é igual ao esperado', () => {
    expect(verifyWebhookVerifyToken({ receivedToken: 'meu-token', expectedToken: 'meu-token' })).toBe(true)
  })

  test('rejeita quando o token recebido é diferente do esperado', () => {
    expect(verifyWebhookVerifyToken({ receivedToken: 'token-errado', expectedToken: 'meu-token' })).toBe(false)
  })

  test('rejeita quando o token recebido é nulo', () => {
    expect(verifyWebhookVerifyToken({ receivedToken: null, expectedToken: 'meu-token' })).toBe(false)
  })
})
