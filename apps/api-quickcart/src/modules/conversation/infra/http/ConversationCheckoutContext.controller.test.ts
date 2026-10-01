/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Token assinado pelo `TokenService` real: a diferença entre 401 e 403 só é honesta com token de verdade.
 */

import { describe, expect, it } from 'bun:test'
import { TokenService } from '@adatechnology/user-module'
import type { UserModule } from '@adatechnology/user-module'

import type { ParsedRequest, ResponseHelper } from '@/infra/http/router'
import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'
import { ForbiddenError, UnauthorizedError } from '@/shared/errors/AppError.error'
import type { ConversationCheckoutContext } from '@/modules/conversation/application/types/GetConversationCheckoutContext.types'
import { ConversationCheckoutContextController } from './ConversationCheckoutContext.controller'

const SECRET = 'segredo-de-teste-com-no-minimo-32-caracteres'
const PHONE = '5511999990000'

const tokenService = new TokenService({ secret: SECRET, issuer: 'quickcart', audience: 'quickcart' })
const userModule = { verifyAccessToken: (token: string) => tokenService.verify(token) } as unknown as UserModule

const CHECKOUT_CONTEXT: ConversationCheckoutContext = {
  items: [{ name: 'Arroz 5kg', quantity: 2, lineTotalInCents: 4980 }],
  subtotalInCents: 4980,
  deliveryType: 'delivery',
  deliveryFeeInCents: 800,
  deliveryDistanceKm: 6.4,
  deliveryTierMaxKm: 8,
  deliveryLocationSource: 'cep',
  amountDueInCents: 5780,
  address: 'Praça da Sé, 10 — Sé, São Paulo/SP',
  paymentMethod: 'pix',
  cashChangeForInCents: null,
}

function buildRequest(authorization?: string): ParsedRequest {
  return {
    method: 'GET',
    url: `/v1/admin/conversations/${PHONE}/checkout-context`,
    query: new URLSearchParams(),
    headers: authorization ? { authorization } : {},
    params: [PHONE],
    body: undefined,
    rawBody: Buffer.from(''),
  }
}

async function requestAs(role: string): Promise<ParsedRequest> {
  const { accessToken } = await tokenService.sign({ id: 'user-1', email: 'pessoa@quickcart.test', name: 'Pessoa', role, isActive: true })
  return buildRequest(`Bearer ${accessToken}`)
}

function buildResponseSpy() {
  const calls: { statusCode: number; payload: unknown }[] = []
  const response = {
    json(statusCode: number, payload: unknown) {
      calls.push({ statusCode, payload })
    },
  } as unknown as ResponseHelper
  return { response, calls }
}

function buildController(result: ConversationCheckoutContext | undefined) {
  const requestedNumbers: string[] = []
  const controller = new ConversationCheckoutContextController({
    userModule,
    getConversationCheckoutContextUseCase: {
      async execute(params) {
        requestedNumbers.push(params.whatsappNumber)
        return result
      },
    },
  })
  return { controller, requestedNumbers }
}

describe('ConversationCheckoutContextController.handleGetCheckoutContext', () => {
  for (const role of [QUICKCART_ROLE.ADMIN, QUICKCART_ROLE.ATTENDANT]) {
    it(`${role} recebe 200 com o recorte do pedido`, async () => {
      const { controller, requestedNumbers } = buildController(CHECKOUT_CONTEXT)
      const { response, calls } = buildResponseSpy()

      await controller.handleGetCheckoutContext(await requestAs(role), response)

      expect(requestedNumbers).toEqual([PHONE])
      expect(calls).toEqual([{ statusCode: 200, payload: { data: CHECKOUT_CONTEXT } }])
    })
  }

  for (const role of [QUICKCART_ROLE.PICKER, QUICKCART_ROLE.DRIVER]) {
    it(`${role} recebe 403`, async () => {
      const { controller, requestedNumbers } = buildController(CHECKOUT_CONTEXT)
      const { response } = buildResponseSpy()

      await expect(controller.handleGetCheckoutContext(await requestAs(role), response)).rejects.toBeInstanceOf(ForbiddenError)
      expect(requestedNumbers).toEqual([])
    })
  }

  it('sem sessão recebe 401', async () => {
    const { controller } = buildController(CHECKOUT_CONTEXT)
    const { response } = buildResponseSpy()

    await expect(controller.handleGetCheckoutContext(buildRequest(), response)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('sem pedido em andamento responde 200 com data null, e não 404', async () => {
    const { controller } = buildController(undefined)
    const { response, calls } = buildResponseSpy()

    await controller.handleGetCheckoutContext(await requestAs(QUICKCART_ROLE.ATTENDANT), response)

    expect(calls).toEqual([{ statusCode: 200, payload: { data: null } }])
  })
})
