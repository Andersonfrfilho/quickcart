/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Documentação da api: `/v1/openapi.json` com o documento, `/v1/docs` com o Scalar em cima dele.
 *
 * A task original dizia "merge dos paths de notificação no Swagger do quickcart", mas não havia
 * Swagger nenhum — a api tinha `/v1/health` e nada de documentação. Scalar em vez de Swagger UI:
 * um `<script>` e nenhum passo de build, busca que funciona, e leitura muito melhor em tela de
 * celular, que é onde alguém confere um contrato no meio de um atendimento.
 *
 * O valor não está na UI. Está no `notificationOpenApiPaths` derivar da MESMA tabela de rotas que o
 * adaptador monta: a documentação não pode divergir da implementação porque as duas leem a mesma
 * fonte. Rota nova do módulo aparece aqui sem ninguém escrever nada.
 *
 * Fora de produção apenas. Documentar a superfície inteira para quem não está autenticado é
 * entregar o mapa das rotas de graça.
 */

import { notificationOpenApiPaths } from '@adatechnology/notification-module/openapi'
import type { ModuleRouteTable } from '@adatechnology/module-http'

import type { Router } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'

const OPENAPI_VERSION = '3.1.0'
const NOTIFICATION_BASE_PATH = '/v1'
const OPENAPI_DOCUMENT_PATH = '/v1/openapi.json'

/**
 * Scalar vem do CDN, e é escolha consciente: a rota só existe fora de produção, então uma
 * dependência de ~2 MB no `package.json` da api para servir uma tela de desenvolvimento sairia
 * mais caro que a requisição externa. Se um dia isto precisar rodar offline ou em produção, aí sim
 * `@scalar/api-reference` entra como dependência e o script vira local.
 */
const SCALAR_CDN_URL = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'

export function buildQuickCartOpenApiDocument(params: { readonly notificationRoutes: ModuleRouteTable }): unknown {
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: 'QuickCart API',
      version: '1.0.0',
      description:
        'As rotas de notificação são geradas da tabela de rotas do @adatechnology/notification-module — ' +
        'a mesma que o adaptador HTTP monta, então documentação e implementação não podem divergir.',
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
    paths: {
      '/v1/health': {
        get: {
          operationId: 'getHealth',
          summary: 'Estado do processo, do banco e do Redis',
          tags: ['health'],
          responses: { '200': { description: 'ok' } },
        },
      },
      ...notificationOpenApiPaths({ routes: params.notificationRoutes, basePath: NOTIFICATION_BASE_PATH }),
    },
  }
}

function buildScalarPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QuickCart API</title>
  </head>
  <body>
    <script id="api-reference" data-url="${OPENAPI_DOCUMENT_PATH}"></script>
    <script src="${SCALAR_CDN_URL}"></script>
  </body>
</html>
`
}

type RegisterOpenApiRoutesParams = {
  readonly router: Router
  readonly notificationRoutes: ModuleRouteTable
}

export function registerOpenApiRoutes(params: RegisterOpenApiRoutesParams): void {
  if (environment.NODE_ENV === 'production') return

  // Montado uma vez no boot: a tabela de rotas não muda em runtime, e remontar por requisição
  // gastaria CPU para produzir sempre o mesmo JSON.
  const document = buildQuickCartOpenApiDocument({ notificationRoutes: params.notificationRoutes })
  const page = new TextEncoder().encode(buildScalarPage())

  params.router.get(OPENAPI_DOCUMENT_PATH, async (_request, response) => {
    response.json(200, document)
  })

  // `binary` e não `text`: o `text` do router fixa `text/plain`, e HTML servido como texto puro
  // aparece como código-fonte na tela. `binary` é o único que aceita o content-type.
  params.router.get('/v1/docs', async (_request, response) => {
    response.binary(200, page, { 'Content-Type': 'text/html; charset=utf-8' })
  })
}
