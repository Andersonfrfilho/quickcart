/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Router fino sobre uWebSockets.js: extrai tudo do HttpRequest de forma síncrona
 * (regra do uWS — req só é válido antes do primeiro await), aplica CORS, lê o body
 * com timeout e centraliza o exception filter (AppError vira envelope tipado,
 * erro desconhecido vira 500 genérico + Sentry, nunca vaza stack trace ao cliente).
 */

import type { HttpRequest, HttpResponse, TemplatedApp } from 'uWebSockets.js'
import { runWithContext } from '@/shared/request-context'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { AppError, TooManyRequestsError } from '@/shared/errors/AppError.error'
import { DomainError } from '@/shared/errors/DomainError'
import { INTERNAL_ERROR, NOT_FOUND, REQUEST_TIMEOUT, INVALID_JSON_BODY } from '@/shared/errors/codes'
import { captureError } from '@/infra/observability/sentry'
import { getAllowedOrigins } from '@/infra/config/environment'

const BODY_READ_TIMEOUT_MS = 10_000

const httpLog = logger.child('Http')

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

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
  error(error: unknown): void
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

function extractHeaders(req: HttpRequest): Record<string, string> {
  const headers: Record<string, string> = {}
  req.forEach((key, value) => {
    headers[key] = value
  })
  return headers
}

function extractParams(req: HttpRequest, pattern: string): readonly string[] {
  const paramCount = (pattern.match(/:/g) ?? []).length
  const params: string[] = []
  for (let index = 0; index < paramCount; index += 1) {
    params.push(req.getParameter(index) ?? '')
  }
  return params
}

type RawBody = {
  readonly raw: Buffer
  readonly parsed: unknown
}

function readBody(res: HttpResponse, isAborted: () => boolean): Promise<RawBody> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0)

    const timeoutId = setTimeout(() => {
      reject(new AppError('Request body read timeout', 408, REQUEST_TIMEOUT))
    }, BODY_READ_TIMEOUT_MS)

    res.onData((chunk, isLast) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk.slice(0))])
      if (!isLast) return

      clearTimeout(timeoutId)
      if (isAborted()) return
      if (buffer.length === 0) {
        resolve({ raw: buffer, parsed: undefined })
        return
      }
      try {
        resolve({ raw: buffer, parsed: JSON.parse(buffer.toString('utf-8')) })
      } catch {
        reject(new AppError('Invalid JSON body', 400, INVALID_JSON_BODY))
      }
    })
  })
}

function buildErrorPayload(error: AppError): { error: { code: string; message: string } } {
  return { error: { code: error.code, message: error.message } }
}

function buildResponseHelper(params: {
  readonly res: HttpResponse
  readonly isAborted: () => boolean
  readonly origin: string | undefined
}): ResponseHelper {
  const { res, isAborted, origin } = params

  function json(statusCode: number, payload: unknown, extraHeaders?: Record<string, string>): void {
    if (isAborted()) return
    res.cork(() => {
      res.writeStatus(String(statusCode))
      res.writeHeader('Content-Type', 'application/json')
      const corsOrigin = resolveCorsOrigin(origin)
      if (corsOrigin) {
        res.writeHeader('Access-Control-Allow-Origin', corsOrigin)
        res.writeHeader('Vary', 'Origin')
      }
      if (extraHeaders) {
        for (const [key, value] of Object.entries(extraHeaders)) res.writeHeader(key, value)
      }
      res.end(JSON.stringify(payload))
    })
  }

  function text(statusCode: number, body: string): void {
    if (isAborted()) return
    res.cork(() => {
      res.writeStatus(String(statusCode))
      res.writeHeader('Content-Type', 'text/plain')
      res.end(body)
    })
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

  return { json, text, error }
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
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  captureError(error)
}

export class Router {
  constructor(private readonly app: TemplatedApp) {}

  get(pattern: string, handler: RouteHandler): void {
    this.register('get', pattern, handler, false)
  }

  post(pattern: string, handler: RouteHandler): void {
    this.register('post', pattern, handler, true)
  }

  put(pattern: string, handler: RouteHandler): void {
    this.register('put', pattern, handler, true)
  }

  patch(pattern: string, handler: RouteHandler): void {
    this.register('patch', pattern, handler, true)
  }

  delete(pattern: string, handler: RouteHandler): void {
    this.register('delete', pattern, handler, false)
  }

  private register(method: HttpMethod, pattern: string, handler: RouteHandler, expectsBody: boolean): void {
    const uwsMethod = method === 'delete' ? 'del' : method

    this.app[uwsMethod](pattern, (res: HttpResponse, req: HttpRequest) => {
      let aborted = false
      res.onAborted(() => {
        aborted = true
      })

      const requestMethod = req.getCaseSensitiveMethod()
      const url = req.getUrl()
      const query = new URLSearchParams(req.getQuery())
      const headers = extractHeaders(req)
      const params = extractParams(req, pattern)
      const origin = headers['origin']
      const startedAt = Date.now()

      const responseHelper = buildResponseHelper({ res, isAborted: () => aborted, origin })

      runWithContext(async () => {
        httpLog.debug(LOG_EVENTS.REQUEST, { method: requestMethod, url })
        try {
          const { raw: rawBody, parsed: body } = expectsBody
            ? await readBody(res, () => aborted)
            : { raw: Buffer.alloc(0), parsed: undefined }
          await handler({ method: requestMethod, url, query, headers, params, body, rawBody }, responseHelper)
        } catch (caughtError) {
          logErrorAndReport({ method: requestMethod, url, durationMs: Date.now() - startedAt, error: caughtError })
          responseHelper.error(caughtError)
        }
      }).catch((fatalError) => {
        httpLog.error(LOG_EVENTS.RESPONSE_UNHANDLED, {
          method: requestMethod,
          url,
          message: fatalError instanceof Error ? fatalError.message : String(fatalError),
        })
      })
    })
  }

  registerNotFoundHandler(): void {
    this.app.any('/*', (res: HttpResponse, req: HttpRequest) => {
      let aborted = false
      res.onAborted(() => {
        aborted = true
      })
      const origin = req.getHeader('origin')
      const responseHelper = buildResponseHelper({ res, isAborted: () => aborted, origin })
      responseHelper.error(new AppError('Route not found', 404, NOT_FOUND))
    })
  }

  registerCorsPreflight(): void {
    this.app.options('/*', (res: HttpResponse, req: HttpRequest) => {
      const origin = req.getHeader('origin')
      res.cork(() => {
        res.writeStatus('204')
        const corsOrigin = resolveCorsOrigin(origin)
        if (corsOrigin) {
          res.writeHeader('Access-Control-Allow-Origin', corsOrigin)
          res.writeHeader('Vary', 'Origin')
        }
        res.writeHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        res.endWithoutBody()
      })
    })
  }
}
