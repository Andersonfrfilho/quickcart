/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import { ValidationError } from '@/shared/errors/AppError.error'

import { Router, type MountedModuleRouter } from './router'

const ALLOWED_ORIGIN = 'http://localhost:5173'

function buildRouter(): Router {
  const router = new Router()
  router.registerCorsPreflight()
  router.get('/v1/ping', (_request, response) => response.json(200, { data: 'pong' }))
  router.get('/v1/broken', () => {
    throw new ValidationError()
  })
  const moduleRouter: MountedModuleRouter = {
    match: (request) => new URL(request.url).pathname === '/v1/module',
    handle: async () => new Response('{}', { status: 200 }),
  }
  router.mount(moduleRouter)
  router.registerNotFoundHandler()
  return router
}

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  expect(response.headers.get('x-frame-options')).toBe('DENY')
  expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  expect(response.headers.get('permissions-policy')).toContain('camera=()')
}

describe('headers de segurança', () => {
  it('200 carrega os headers e mantém o CORS com credenciais', async () => {
    const response = await buildRouter().handle(
      new Request('http://localhost/v1/ping', { headers: { origin: ALLOWED_ORIGIN } }),
    )

    expect(response.status).toBe(200)
    expectSecurityHeaders(response)
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('erro 4xx carrega os headers', async () => {
    const response = await buildRouter().handle(new Request('http://localhost/v1/broken'))

    expect(response.status).toBe(422)
    expectSecurityHeaders(response)
  })

  it('404 carrega os headers', async () => {
    const response = await buildRouter().handle(new Request('http://localhost/v1/nothing-here'))

    expect(response.status).toBe(404)
    expectSecurityHeaders(response)
  })

  it('resposta de módulo montado e preflight carregam os headers', async () => {
    const router = buildRouter()
    expectSecurityHeaders(await router.handle(new Request('http://localhost/v1/module')))
    expectSecurityHeaders(
      await router.handle(new Request('http://localhost/v1/ping', { method: 'OPTIONS', headers: { origin: ALLOWED_ORIGIN } })),
    )
  })

  it('HSTS só quando a requisição veio por https — em http local atrapalharia o desenvolvimento', async () => {
    const router = buildRouter()
    const overHttp = await router.handle(new Request('http://localhost/v1/ping'))
    const overHttps = await router.handle(
      new Request('http://localhost/v1/ping', { headers: { 'x-forwarded-proto': 'https' } }),
    )

    expect(overHttp.headers.get('strict-transport-security')).toBeNull()
    expect(overHttps.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains')
  })
})
