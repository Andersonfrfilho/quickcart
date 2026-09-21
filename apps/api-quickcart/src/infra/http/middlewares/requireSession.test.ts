/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Token assinado pelo `TokenService` real do pacote — a distinção que importa aqui (401 de sessão
 * inválida contra 403 de papel insuficiente) só é honesta se o token for de verdade.
 */

import { describe, expect, it } from 'bun:test'
import { TokenService } from '@adatechnology/user-module'
import type { UserModule } from '@adatechnology/user-module'

import type { ParsedRequest } from '@/infra/http/router'
import { UnauthorizedError, ForbiddenError } from '@/shared/errors/AppError.error'
import { SESSION_INVALID, SESSION_ROLE_FORBIDDEN } from '@/shared/errors/codes'
import { QUICKCART_ROLE, ADMIN_ONLY, ORDER_READERS } from '@/modules/user/shared/User.constant'

import { requireSession } from './requireSession'

const SECRET = 'segredo-de-teste-com-no-minimo-32-caracteres'
const USER_ID = '33333333-3333-4333-8333-333333333333'

const tokenService = new TokenService({ secret: SECRET, issuer: 'quickcart', audience: 'quickcart' })
const userModule = { verifyAccessToken: (token: string) => tokenService.verify(token) } as unknown as UserModule

async function requestFor(role: string): Promise<ParsedRequest> {
  const { accessToken } = await tokenService.sign({
    id: USER_ID,
    email: 'pessoa@quickcart.test',
    name: 'Pessoa',
    role,
    isActive: true,
  })
  return { headers: { authorization: `Bearer ${accessToken}` } } as unknown as ParsedRequest
}

describe('requireSession', () => {
  it('devolve a identidade quando o papel está na lista da rota', async () => {
    const session = await requireSession({
      request: await requestFor(QUICKCART_ROLE.ADMIN),
      roles: ADMIN_ONLY,
      userModule,
    })

    expect(session).toEqual({ userId: USER_ID, email: 'pessoa@quickcart.test', role: QUICKCART_ROLE.ADMIN })
  })

  it('401 quando não há token — a sessão sequer existe', async () => {
    const promise = requireSession({
      request: { headers: {} } as unknown as ParsedRequest,
      roles: ADMIN_ONLY,
      userModule,
    })

    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(promise).rejects.toMatchObject({ code: SESSION_INVALID })
  })

  it('403, e não 401, quando a sessão é legítima mas o papel não alcança a rota', async () => {
    const promise = requireSession({
      request: await requestFor(QUICKCART_ROLE.DRIVER),
      roles: ADMIN_ONLY,
      userModule,
    })

    await expect(promise).rejects.toBeInstanceOf(ForbiddenError)
    await expect(promise).rejects.toMatchObject({ code: SESSION_ROLE_FORBIDDEN })
  })

  it('o cliente final não entra em rota de painel, mesmo com sessão válida', async () => {
    const promise = requireSession({
      request: await requestFor(QUICKCART_ROLE.CUSTOMER),
      roles: ORDER_READERS,
      userModule,
    })

    await expect(promise).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('o motorista lê a fila de pedidos, mas não mexe no catálogo', async () => {
    const request = await requestFor(QUICKCART_ROLE.DRIVER)

    expect(await requireSession({ request, roles: ORDER_READERS, userModule })).toMatchObject({
      role: QUICKCART_ROLE.DRIVER,
    })
    await expect(requireSession({ request, roles: ADMIN_ONLY, userModule })).rejects.toBeInstanceOf(ForbiddenError)
  })
})
