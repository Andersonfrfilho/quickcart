/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Router fino sobre Bun.serve: casa o Request contra padrões registrados (params
 * posicionais via regex), aplica CORS, lê o body com timeout preservando os bytes
 * crus (necessário para a verificação HMAC do webhook) e centraliza o exception
 * filter (AppError vira envelope tipado, erro desconhecido vira 500 genérico +
 * Sentry, nunca vaza stack trace ao cliente).
 */

import { runWithContext } from '@/shared/request-context'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { AppError, TooManyRequestsError } from '@/shared/errors/AppError.error'
import { DomainError } from '@/shared/errors/DomainError'
import { INTERNAL_ERROR, NOT_FOUND, REQUEST_TIMEOUT, INVALID_JSON_BODY } from '@/shared/errors/codes'
import { captureError } from '@/infra/observability/sentry'
import { getAllowedOrigins } from '@/infra/config/environment'
import { serializeError } from '@/shared/serializeError'

const BODY_READ_TIMEOUT_MS = 10_000
const CORS_ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization'

const httpLog = logger.child('Http')

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ParsedRequest = {
  readonly method: string
  readonly url: string
  readonly query: URLSearchParams
  readonly headers: Record<string, string>
  readonly params: readonly string[]
  readonly body: unknown
  readonly rawBody: Buffer
}

export type ResponseHelper = {
  json(statusCode: number, payload: unknown, extraHeaders?: Record<string, string>): void
  text(statusCode: number, body: string): void
  /**
   * Resposta binária de tamanho conhecido (arquivo, zip). Distinta de `stream`, que só escreve
   * string e existe para SSE — mandar bytes por lá corromperia o conteúdo na conversão para UTF-8.
   */
  binary(statusCode: number, body: Uint8Array, headers: Record<string, string>): void
  error(error: unknown): void
  // Resposta de duração indefinida (SSE). Devolve o writer para o handler empurrar eventos e
  // o `close` que o chamador precisa registrar para soltar a inscrição quando o cliente sai —
  // sem isso cada aba fechada deixaria um listener pendurado.
  stream(params: StreamResponseParams): void
}

export type StreamResponseParams = {
  readonly contentType: string
  readonly onOpen: (writer: StreamWriter) => void | Promise<void>
  readonly onClose: () => void
}

export type StreamWriter = {
  write(chunk: string): void
  close(): void
}

export type RouteHandler = (
  request: ParsedRequest,
  response: ResponseHelper,
) => Promise<void> | void

function resolveCorsOrigin(origin: string | undefined): string | undefined {
  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.includes('*')) return '*'
  if (origin && allowedOrigins.includes(origin)) return origin
  return undefined
}

function compileRoutePattern(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '([^/]+)' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/')
  return new RegExp(`^${source}$`)
}

type RawBody = {
  readonly raw: Buffer
  readonly parsed: unknown
}

async function readBody(request: Request): Promise<RawBody> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new AppError('Request body read timeout', 408, REQUEST_TIMEOUT)), BODY_READ_TIMEOUT_MS)
  })
  const arrayBuffer = await Promise.race([request.arrayBuffer(), timeout])
  const raw = Buffer.from(arrayBuffer)
  if (raw.length === 0) return { raw, parsed: undefined }
  try {
    return { raw, parsed: JSON.parse(raw.toString('utf-8')) }
  } catch {
    throw new AppError('Invalid JSON body', 400, INVALID_JSON_BODY)
  }
}

function buildErrorPayload(error: AppError): { error: { code: string; message: string; details?: Record<string, unknown> } } {
  const details = error instanceof DomainError ? error.details : undefined
  return { error: { code: error.code, message: error.message, ...(details ? { details } : {}) } }
}

function buildCorsHeaders(origin: string | undefined): Headers {
  const headers = new Headers()
  const corsOrigin = resolveCorsOrigin(origin)
  if (corsOrigin) {
    headers.set('Access-Control-Allow-Origin', corsOrigin)
    headers.set('Vary', 'Origin')
  }
  return headers
}

function buildResponseHelper(params: { readonly origin: string | undefined }): {
  readonly helper: ResponseHelper
  readonly responsePromise: Promise<Response>
} {
  const { origin } = params
  let resolveResponse!: (response: Response) => void
  const responsePromise = new Promise<Response>((resolve) => {
    resolveResponse = resolve
  })

  function json(statusCode: number, payload: unknown, extraHeaders?: Record<string, string>): void {
    const headers = buildCorsHeaders(origin)
    headers.set('Content-Type', 'application/json')
    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value)
    }
    resolveResponse(new Response(JSON.stringify(payload), { status: statusCode, headers }))
  }

  function text(statusCode: number, body: string): void {
    const headers = buildCorsHeaders(origin)
    headers.set('Content-Type', 'text/plain')
    resolveResponse(new Response(body, { status: statusCode, headers }))
  }

  function binary(statusCode: number, body: Uint8Array, extraHeaders: Record<string, string>): void {
    const headers = buildCorsHeaders(origin)
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value)
    headers.set('Content-Length', String(body.byteLength))
    resolveResponse(new Response(body, { status: statusCode, headers }))
  }

  function error(caughtError: unknown): void {
    if (!(caughtError instanceof AppError)) {
      json(500, { error: { code: INTERNAL_ERROR, message: 'Internal server error' } })
      return
    }
    if (caughtError instanceof TooManyRequestsError) {
      json(caughtError.statusCode, buildErrorPayload(caughtError), {
        'Retry-After': String(caughtError.retryAfterSeconds),
      })
      return
    }
    json(caughtError.statusCode, buildErrorPayload(caughtError))
  }

  function stream(streamParams: StreamResponseParams): void {
    const headers = buildCorsHeaders(origin)
    headers.set('Content-Type', streamParams.contentType)
    // Sem estes dois um proxy reverso costuma bufferizar o corpo e a inbox só recebe os
    // eventos em blocos, ou nunca — o sintoma clássico de "o SSE funciona local e não em prod".
    headers.set('Cache-Control', 'no-cache, no-transform')
    headers.set('Connection', 'keep-alive')

    const encoder = new TextEncoder()
    let closed = false

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const writer: StreamWriter = {
          write(chunk: string): void {
            if (closed) return
            controller.enqueue(encoder.encode(chunk))
          },
          close(): void {
            if (closed) return
            closed = true
            controller.close()
            streamParams.onClose()
          },
        }
        void streamParams.onOpen(writer)
      },
      // Disparado quando o cliente desconecta. É aqui que a inscrição é solta.
      cancel() {
        if (closed) return
        closed = true
        streamParams.onClose()
      },
    })

    resolveResponse(new Response(body, { status: 200, headers }))
  }

  return { helper: { json, text, binary, error, stream }, responsePromise }
}

function logErrorAndReport(params: {
  readonly method: string
  readonly url: string
  readonly durationMs: number
  readonly error: unknown
}): void {
  const { method, url, durationMs, error } = params

  if (error instanceof AppError) {
    const domainMeta = error instanceof DomainError ? { domain: error.domain, details: error.details } : {}
    httpLog.info(LOG_EVENTS.RESPONSE_ERROR, {
      method,
      url,
      code: error.code,
      status: error.statusCode,
      durationMs,
      ...domainMeta,
    })
    return
  }

  httpLog.error(LOG_EVENTS.RESPONSE_UNHANDLED, {
    method,
    url,
    durationMs,
    message: serializeError(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  captureError(error)
}

type CompiledRoute = {
  readonly method: HttpMethod
  readonly regex: RegExp
  readonly expectsBody: boolean
  readonly handler: RouteHandler
}

export class Router {
  private readonly routes: CompiledRoute[] = []
  private corsPreflightEnabled = false
  private notFoundHandlerRegistered = false

  get(pattern: string, handler: RouteHandler): void {
    this.register('GET', pattern, handler, false)
  }

  post(pattern: string, handler: RouteHandler): void {
    this.register('POST', pattern, handler, true)
  }

  put(pattern: string, handler: RouteHandler): void {
    this.register('PUT', pattern, handler, true)
  }

  patch(pattern: string, handler: RouteHandler): void {
    this.register('PATCH', pattern, handler, true)
  }

  delete(pattern: string, handler: RouteHandler): void {
    this.register('DELETE', pattern, handler, false)
  }

  registerCorsPreflight(): void {
    this.corsPreflightEnabled = true
  }

  registerNotFoundHandler(): void {
    this.notFoundHandlerRegistered = true
  }

  private register(method: HttpMethod, pattern: string, handler: RouteHandler, expectsBody: boolean): void {
    this.routes.push({ method, regex: compileRoutePattern(pattern), expectsBody, handler })
  }

  private findRoute(method: string, pathname: string): { route: CompiledRoute; params: readonly string[] } | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue
      const match = route.regex.exec(pathname)
      if (!match) continue
      return { route, params: match.slice(1) as readonly string[] }
    }
    return undefined
  }

  async handle(request: Request): Promise<Response> {
    const origin = request.headers.get('origin') ?? undefined

    if (this.corsPreflightEnabled && request.method === 'OPTIONS') {
      const headers = buildCorsHeaders(origin)
      headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS)
      headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS)
      return new Response(null, { status: 204, headers })
    }

    const url = new URL(request.url)
    const matched = this.findRoute(request.method, url.pathname)

    if (!matched) {
      if (!this.notFoundHandlerRegistered) return new Response(null, { status: 404 })
      const { helper, responsePromise } = buildResponseHelper({ origin })
      helper.error(new AppError('Route not found', 404, NOT_FOUND))
      return responsePromise
    }

    const { route, params } = matched
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    const startedAt = Date.now()
    const { helper, responsePromise } = buildResponseHelper({ origin })

    await runWithContext(async () => {
      httpLog.debug(LOG_EVENTS.REQUEST, { method: request.method, url: url.pathname })
      try {
        const { raw: rawBody, parsed: body } = route.expectsBody
          ? await readBody(request)
          : { raw: Buffer.alloc(0), parsed: undefined }
        await route.handler(
          { method: request.method, url: url.pathname, query: url.searchParams, headers, params, body, rawBody },
          helper,
        )
      } catch (caughtError) {
        logErrorAndReport({ method: request.method, url: url.pathname, durationMs: Date.now() - startedAt, error: caughtError })
        helper.error(caughtError)
      }
    })

    return responsePromise
  }
}
