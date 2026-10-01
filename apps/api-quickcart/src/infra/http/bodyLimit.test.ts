/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Teto de corpo por rota: a cotação pública recusa com 413 antes de parsear, inclusive quando o
 * corpo vem chunked (sem Content-Length). Rotas sem a opção seguem aceitando corpo grande.
 */

import { describe, expect, it } from 'bun:test'

import { Router } from './router'

const LIMIT_BYTES = 1024

function buildRouter(): { router: Router; handledBodies: unknown[] } {
  const handledBodies: unknown[] = []
  const router = new Router()
  router.post('/limited', (request, response) => {
    handledBodies.push(request.body)
    response.json(200, { data: 'ok' })
  }, { maxBodyBytes: LIMIT_BYTES })
  router.post('/unlimited', (request, response) => {
    handledBodies.push(request.body)
    response.json(200, { data: 'ok' })
  })
  router.registerNotFoundHandler()
  return { router, handledBodies }
}

function jsonOfSize(bytes: number): string {
  return JSON.stringify({ padding: 'x'.repeat(bytes) })
}

function chunkedStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += 256) controller.enqueue(bytes.slice(offset, offset + 256))
      controller.close()
    },
  })
}

describe('Router — maxBodyBytes', () => {
  it('Content-Length acima do teto responde 413 sem chamar o handler', async () => {
    const { router, handledBodies } = buildRouter()
    const body = jsonOfSize(LIMIT_BYTES * 2)

    const response = await router.handle(
      new Request('http://localhost/limited', { method: 'POST', body, headers: { 'content-length': String(body.length) } }),
    )

    expect(response.status).toBe(413)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE')
    expect(handledBodies).toHaveLength(0)
  })

  it('corpo chunked (sem Content-Length) acima do teto também responde 413', async () => {
    const { router, handledBodies } = buildRouter()

    const response = await router.handle(
      new Request('http://localhost/limited', { method: 'POST', body: chunkedStream(jsonOfSize(LIMIT_BYTES * 4)) }),
    )

    expect(response.status).toBe(413)
    expect(handledBodies).toHaveLength(0)
  })

  it('corpo dentro do teto é parseado normalmente, inclusive chunked', async () => {
    const { router, handledBodies } = buildRouter()

    const response = await router.handle(
      new Request('http://localhost/limited', { method: 'POST', body: chunkedStream(JSON.stringify({ hello: 'world' })) }),
    )

    expect(response.status).toBe(200)
    expect(handledBodies[0]).toEqual({ hello: 'world' })
  })

  it('rota sem a opção continua aceitando corpo grande (upload de mídia)', async () => {
    const { router } = buildRouter()

    const response = await router.handle(new Request('http://localhost/unlimited', { method: 'POST', body: jsonOfSize(LIMIT_BYTES * 8) }))

    expect(response.status).toBe(200)
  })
})
