/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * CORS com CREDENCIAIS, que é o regime desde que a sessão passou a viver em cookie.
 *
 * Estes testes existem porque a suíte inteira passava verde com o painel de staging incapaz de
 * fazer uma única chamada: sem `Access-Control-Allow-Credentials`, o navegador recusa o preflight
 * de toda requisição com `credentials: 'include'`. `curl` não aplica CORS e não via nada.
 */

import { describe, expect, it } from 'bun:test'

import { Router } from './router'

const ALLOWED_ORIGIN = 'http://localhost:5173'
const FOREIGN_ORIGIN = 'https://evil.example'

function buildRouter(): Router {
  const router = new Router()
  router.registerCorsPreflight()
  router.get('/v1/ping', (_request, response) => response.json(200, { data: 'pong' }))
  router.registerNotFoundHandler()
  return router
}

function preflight(origin: string): Request {
  return new Request('http://localhost/v1/ping', {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'GET' },
  })
}

describe('CORS', () => {
  it('permite credenciais na origem da allowlist — sem isto o navegador recusa TODA chamada', async () => {
    const response = await buildRouter().handle(preflight(ALLOWED_ORIGIN))

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('nunca devolve `*` como origem: com credenciais isso é inválido por especificação', async () => {
    const response = await buildRouter().handle(preflight(ALLOWED_ORIGIN))

    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    expect(response.headers.get('access-control-allow-origin')).not.toBe('*')
  })

  it('origem fora da allowlist não recebe header de origem — o CORS é a tranca', async () => {
    const response = await buildRouter().handle(preflight(FOREIGN_ORIGIN))

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('varia por origem, para cache não servir a resposta de uma origem para outra', async () => {
    const response = await buildRouter().handle(preflight(ALLOWED_ORIGIN))

    expect(response.headers.get('vary')).toBe('Origin')
  })

  it('a resposta REAL também carrega os headers, não só o preflight', async () => {
    const response = await buildRouter().handle(
      new Request('http://localhost/v1/ping', { headers: { origin: ALLOWED_ORIGIN } }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('anuncia Idempotency-Key: o checkout manda esse header e o preflight precisa autorizá-lo', async () => {
    const response = await buildRouter().handle(preflight(ALLOWED_ORIGIN))

    expect(response.headers.get('access-control-allow-headers')).toContain('Idempotency-Key')
  })
})
