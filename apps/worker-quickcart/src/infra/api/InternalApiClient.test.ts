/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O dublê aqui é do `fetch`, não da api: o formato `{ data: { accessToken, expiresInSeconds } }` é
 * o que o `user-module` devolve de fato em `POST /auth/login` — conferido no pacote, não suposto.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { resumeConversation } from './InternalApiClient'
import { invalidateServiceSession } from './ServiceSession'

type Call = { readonly url: string; readonly authorization: string | undefined }

const originalFetch = globalThis.fetch
let calls: Call[] = []

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetch(resumeStatuses: readonly number[]): void {
  let resumeIndex = 0
  let issued = 0

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input)
    const authorization = new Headers(init?.headers).get('authorization') ?? undefined
    calls.push({ url, authorization })

    if (url.endsWith('/v1/auth/login')) {
      issued += 1
      return jsonResponse({ data: { accessToken: `token-${issued}`, expiresInSeconds: 900 } })
    }

    const status = resumeStatuses[resumeIndex] ?? 200
    resumeIndex += 1
    return status === 200 ? jsonResponse({ data: {} }) : new Response('nope', { status })
  }) as typeof fetch
}

const params = { sessionId: 'sessao-1', transcript: null }

beforeEach(() => {
  calls = []
  invalidateServiceSession()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('resumeConversation', () => {
  it('autentica uma vez e reaproveita o token enquanto ele vale', async () => {
    installFetch([200, 200])

    await resumeConversation(params)
    await resumeConversation(params)

    const logins = calls.filter((call) => call.url.endsWith('/v1/auth/login'))
    expect(logins).toHaveLength(1)
    expect(calls.filter((call) => call.url.includes('/internal/'))).toHaveLength(2)
  })

  it('manda o access token da sessão, nunca um segredo de ambiente', async () => {
    installFetch([200])

    await resumeConversation(params)

    const resume = calls.find((call) => call.url.includes('/internal/'))
    expect(resume?.authorization).toBe('Bearer token-1')
  })

  it('no 401 descarta a sessão, reautentica e refaz a chamada uma vez', async () => {
    installFetch([401, 200])

    await resumeConversation(params)

    expect(calls.filter((call) => call.url.endsWith('/v1/auth/login'))).toHaveLength(2)

    const resumes = calls.filter((call) => call.url.includes('/internal/'))
    expect(resumes.map((call) => call.authorization)).toEqual(['Bearer token-1', 'Bearer token-2'])
  })

  it('não entra em laço: um segundo 401 propaga como erro para o BullMQ retentar', async () => {
    installFetch([401, 401])

    await expect(resumeConversation(params)).rejects.toThrow('resume_conversation_failed: 401')
    expect(calls.filter((call) => call.url.includes('/internal/'))).toHaveLength(2)
  })
})
