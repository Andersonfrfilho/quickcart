/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Token assinado pelo `TokenService` real: a diferença entre 401 e 403 só é honesta com token de
 * verdade (mesmo padrão de `ConversationCheckoutContext.controller.test.ts`).
 */

import { describe, expect, it } from 'bun:test'
import { TokenService } from '@adatechnology/user-module'
import type { UserModule } from '@adatechnology/user-module'

import type { ParsedRequest, ResponseHelper } from '@/infra/http/router'
import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'
import { ForbiddenError, UnauthorizedError } from '@/shared/errors/AppError.error'
import type {
  DeliveryFeeTier,
  DeliveryFeeTierRepositoryInterface,
} from '@/modules/order/domain/DeliveryFeeTierRepository.interface'
import { ReplaceDeliveryFeeTiersUseCase } from '@/modules/order/application/use-cases/ReplaceDeliveryFeeTiers.use-case'
import { DeliveryFeeTiersController } from './DeliveryFeeTiers.controller'

const SECRET = 'segredo-de-teste-com-no-minimo-32-caracteres'
const USER_ID = '44444444-4444-4444-8444-444444444444'

const tokenService = new TokenService({ secret: SECRET, issuer: 'quickcart', audience: 'quickcart' })
const userModule = { verifyAccessToken: (token: string) => tokenService.verify(token) } as unknown as UserModule

const VALID_TIERS: readonly DeliveryFeeTier[] = [
  { maxDistanceKm: 3, feeInCents: 500 },
  { maxDistanceKm: 8, feeInCents: 1000 },
]

function buildRequest(params: { authorization?: string; method: 'GET' | 'PUT'; body?: unknown }): ParsedRequest {
  return {
    method: params.method,
    url: '/v1/admin/delivery-fee-tiers',
    query: new URLSearchParams(),
    headers: params.authorization ? { authorization: params.authorization } : {},
    params: [],
    body: params.body,
    rawBody: Buffer.from(''),
  } as unknown as ParsedRequest
}

async function requestAs(role: string, params: { method: 'GET' | 'PUT'; body?: unknown }): Promise<ParsedRequest> {
  const { accessToken } = await tokenService.sign({
    id: USER_ID,
    email: 'pessoa@quickcart.test',
    name: 'Pessoa',
    role,
    isActive: true,
  })
  return buildRequest({ authorization: `Bearer ${accessToken}`, ...params })
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

function buildFakeRepository(initialTiers: readonly DeliveryFeeTier[] = []) {
  let tiers = initialTiers
  const replaceAllCalls: (readonly DeliveryFeeTier[])[] = []
  const repository: DeliveryFeeTierRepositoryInterface = {
    async listOrdered() {
      return tiers
    },
    async replaceAll(next) {
      replaceAllCalls.push(next)
      tiers = next
    },
  }
  return { repository, replaceAllCalls }
}

function buildController(initialTiers: readonly DeliveryFeeTier[] = []) {
  const { repository, replaceAllCalls } = buildFakeRepository(initialTiers)
  const replaceDeliveryFeeTiersUseCase = new ReplaceDeliveryFeeTiersUseCase({ deliveryFeeTierRepository: repository })
  const controller = new DeliveryFeeTiersController({
    deliveryFeeTierRepository: repository,
    replaceDeliveryFeeTiersUseCase,
    userModule,
  })
  return { controller, repository, replaceAllCalls }
}

describe('DeliveryFeeTiersController.handleList', () => {
  it('admin recebe a lista ordenada que o repositório devolve', async () => {
    const { controller } = buildController(VALID_TIERS)
    const { response, calls } = buildResponseSpy()

    await controller.handleList(await requestAs(QUICKCART_ROLE.ADMIN, { method: 'GET' }), response)

    expect(calls).toEqual([{ statusCode: 200, payload: { data: VALID_TIERS } }])
  })

  it('atendente recebe 403', async () => {
    const { controller } = buildController(VALID_TIERS)
    const { response } = buildResponseSpy()

    await expect(
      controller.handleList(await requestAs(QUICKCART_ROLE.ATTENDANT, { method: 'GET' }), response),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('sem sessão recebe 401', async () => {
    const { controller } = buildController(VALID_TIERS)
    const { response } = buildResponseSpy()

    await expect(controller.handleList(buildRequest({ method: 'GET' }), response)).rejects.toBeInstanceOf(
      UnauthorizedError,
    )
  })
})

describe('DeliveryFeeTiersController.handleReplace', () => {
  it('atendente recebe 403 e a lista não é tocada', async () => {
    const { controller, replaceAllCalls } = buildController(VALID_TIERS)
    const { response } = buildResponseSpy()

    await expect(
      controller.handleReplace(
        await requestAs(QUICKCART_ROLE.ATTENDANT, { method: 'PUT', body: VALID_TIERS }),
        response,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(replaceAllCalls).toEqual([])
  })

  it('sem sessão recebe 401', async () => {
    const { controller } = buildController(VALID_TIERS)
    const { response } = buildResponseSpy()

    await expect(
      controller.handleReplace(buildRequest({ method: 'PUT', body: VALID_TIERS }), response),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('PUT inválido devolve todos os erros de uma vez, e a lista não é tocada', async () => {
    const { controller, replaceAllCalls } = buildController(VALID_TIERS)
    const { response } = buildResponseSpy()

    const invalidTiers = [
      { maxDistanceKm: 0, feeInCents: -1 },
      { maxDistanceKm: 0.5, feeInCents: 100 },
    ]

    let caughtError: unknown
    try {
      await controller.handleReplace(
        await requestAs(QUICKCART_ROLE.ADMIN, { method: 'PUT', body: invalidTiers }),
        response,
      )
    } catch (error) {
      caughtError = error
    }

    expect(caughtError).toMatchObject({ statusCode: 422 })
    // A mensagem junta as duas violações do primeiro item (`maxDistanceKm` e `feeInCents`) numa só —
    // é isto que prova que o operador vê tudo de uma vez, e não corrige e reenvia várias vezes.
    const message = (caughtError as Error).message
    expect(message).toContain('maxDistanceKm')
    expect(message).toContain('feeInCents')
    expect(replaceAllCalls).toEqual([])
  })

  it('PUT válido substitui a lista inteira', async () => {
    const { controller, replaceAllCalls } = buildController([{ maxDistanceKm: 5, feeInCents: 999 }])
    const { response, calls } = buildResponseSpy()

    await controller.handleReplace(
      await requestAs(QUICKCART_ROLE.ADMIN, { method: 'PUT', body: VALID_TIERS }),
      response,
    )

    expect(replaceAllCalls).toEqual([VALID_TIERS])
    expect(calls).toEqual([{ statusCode: 200, payload: { data: VALID_TIERS } }])
  })

  it('lista vazia é aceita e desliga a entrega (spec §3.1, §4 item 9)', async () => {
    const { controller, replaceAllCalls } = buildController(VALID_TIERS)
    const { response, calls } = buildResponseSpy()

    await controller.handleReplace(await requestAs(QUICKCART_ROLE.ADMIN, { method: 'PUT', body: [] }), response)

    expect(replaceAllCalls).toEqual([[]])
    expect(calls).toEqual([{ statusCode: 200, payload: { data: [] } }])
  })
})
