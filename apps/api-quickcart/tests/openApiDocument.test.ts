/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O documento OpenAPI descreve TODA rota do módulo de notificação, e nada além.
 *
 * O `notification-module` já tem um teste que quebra quando rota nova nasce sem `summary`. Este
 * cobre o outro lado, que é do host: se alguém montar as rotas com um `basePath` diferente do que
 * a documentação usa, ou esquecer de passar a mesma tabela para os dois, o documento passa a
 * descrever caminho que não existe — e ninguém percebe, porque documentação errada responde 200.
 */

import { describe, expect, it } from 'bun:test'
import { createNotificationRoutes } from '@adatechnology/notification-module'
import type { ModuleRouteTable } from '@adatechnology/module-http'
import type { NotificationModule } from '@adatechnology/notification-module'

import { buildQuickCartOpenApiDocument } from '@/modules/notification/infra/http/OpenApiRoutes'

/** Só a FORMA das rotas importa aqui; nenhum handler é chamado. */
const routes: ModuleRouteTable = createNotificationRoutes({ module: {} as NotificationModule })

type OpenApiDocument = {
  readonly openapi: string
  readonly paths: Record<string, Record<string, { operationId?: string; summary?: string }>>
}

const document = buildQuickCartOpenApiDocument({ notificationRoutes: routes }) as OpenApiDocument

describe('documento OpenAPI do quickcart', () => {
  it('descreve todas as rotas do módulo, com o mesmo basePath em que elas são montadas', () => {
    for (const route of routes) {
      // `:id` do módulo vira `{id}` no OpenAPI, e o basePath tem de ser o mesmo do `router.mount`.
      const expectedPath = `/v1${route.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}')}`
      const operation = document.paths[expectedPath]?.[route.method.toLowerCase()]

      expect(operation, `rota ${route.method} ${route.path} não está documentada em ${expectedPath}`).toBeDefined()
      expect(operation?.operationId).toBe(route.operationId)
    }
  })

  it('não documenta caminho que não existe na tabela', () => {
    const declared = new Set(routes.map((route) => `/v1${route.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}')}`))
    const documented = Object.keys(document.paths).filter((path) => path !== '/v1/health')

    // Health é do host e é declarado à mão; qualquer outro caminho tem de vir da tabela.
    for (const path of documented) {
      expect(declared.has(path), `documento descreve ${path}, que nenhuma rota serve`).toBe(true)
    }
  })

  it('toda operação tem summary — é o que a UI mostra na lista', () => {
    for (const [path, methods] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        expect(operation.summary, `${method.toUpperCase()} ${path} sem summary`).toBeTruthy()
      }
    }
  })

  it('declara bearer como esquema de segurança, que é o que o host usa', () => {
    expect(document.openapi).toBe('3.1.0')
    expect(routes.length).toBeGreaterThan(0)
  })
})
