/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O token destes testes é assinado pelo `TokenService` DE VERDADE do pacote, nunca por um objeto
 * de mentira devolvendo claims prontas. Um dublê aqui só confirmaria a forma que eu inventei para
 * o JWT — e é exatamente onde formato de token, claim e expiração passam despercebidos.
 */

import { describe, expect, it } from 'bun:test'
import { TokenService } from '@adatechnology/user-module'
import type { UserModule } from '@adatechnology/user-module'
import type { UserProfile } from '@adatechnology/user-contracts'

import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'

import { createUserAuthContextResolver, extractBearerToken, resolveScopesForRole } from './userAuthContextResolver'

const SECRET = 'segredo-de-teste-com-no-minimo-32-caracteres'
const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

const tokenService = new TokenService({ secret: SECRET, issuer: 'quickcart', audience: 'quickcart' })

function buildProfile(role: string): UserProfile {
  return { id: USER_ID, email: 'pessoa@quickcart.test', name: 'Pessoa', role, isActive: true }
}

/** Só `verifyAccessToken` importa aqui, e ele é o do pacote — o resto do módulo não é exercido. */
function buildModule(): UserModule {
  return { verifyAccessToken: (token: string) => tokenService.verify(token) } as unknown as UserModule
}

async function signFor(role: string): Promise<string> {
  const { accessToken } = await tokenService.sign(buildProfile(role))
  return accessToken
}

describe('extractBearerToken', () => {
  it('devolve undefined sem header, sem prefixo, ou com o token vazio', () => {
    expect(extractBearerToken(undefined)).toBeUndefined()
    expect(extractBearerToken('abc')).toBeUndefined()
    expect(extractBearerToken('Bearer ')).toBeUndefined()
  })

  it('extrai o token depois do prefixo', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })
})

describe('resolveScopesForRole', () => {
  it('dá o escopo admin só ao papel admin — não há hierarquia de papéis', () => {
    expect(resolveScopesForRole(QUICKCART_ROLE.ADMIN)).toContain('admin')

    for (const role of [QUICKCART_ROLE.ATTENDANT, QUICKCART_ROLE.PICKER, QUICKCART_ROLE.DRIVER, QUICKCART_ROLE.CUSTOMER]) {
      expect(resolveScopesForRole(role)).not.toContain('admin')
      expect(resolveScopesForRole(role)).not.toContain('user:admin')
    }
  })

  it('concede `user:admin`, que é o escopo REAL das rotas de /admin/users', () => {
    /*
     * O `scope: 'admin'` da rota é a categoria; o despachante compara `requiredScopes`, e lá está
     * `user:admin`. Conceder só `admin` dava 403 num admin legítimo — e nada além da api de pé
     * mostrava isso, porque o pacote não exporta a constante para o typecheck comparar.
     */
    expect(resolveScopesForRole(QUICKCART_ROLE.ADMIN)).toContain('user:admin')
  })

  it('todo papel autenticado carrega o próprio papel como escopo, além de user', () => {
    expect(resolveScopesForRole(QUICKCART_ROLE.PICKER)).toEqual(['user', QUICKCART_ROLE.PICKER])
  })
})

describe('createUserAuthContextResolver', () => {
  const resolver = createUserAuthContextResolver({ userModule: buildModule(), companyId: COMPANY_ID })

  async function resolveWith(authorization: string | undefined) {
    return resolver.resolve({ headers: authorization ? { authorization } : {} } as never)
  }

  it('resolve identidade a partir de um token assinado pelo pacote', async () => {
    const context = await resolveWith(`Bearer ${await signFor(QUICKCART_ROLE.ATTENDANT)}`)

    expect(context).toEqual({
      companyId: COMPANY_ID,
      userId: USER_ID,
      scopes: ['user', QUICKCART_ROLE.ATTENDANT, 'customers:read', 'customers:write'],
    })
  })

  it('recusa requisição sem header e com token adulterado', async () => {
    expect(await resolveWith(undefined)).toBeUndefined()
    expect(await resolveWith('Bearer nao.e.um.jwt')).toBeUndefined()
  })

  it('recusa token assinado com outro segredo', async () => {
    const outro = new TokenService({ secret: 'outro-segredo-com-no-minimo-32-caracteres!', issuer: 'quickcart', audience: 'quickcart' })
    const { accessToken } = await outro.sign(buildProfile(QUICKCART_ROLE.ADMIN))

    expect(await resolveWith(`Bearer ${accessToken}`)).toBeUndefined()
  })

  it('recusa papel que o produto não conhece, ainda que o token seja válido', async () => {
    expect(await resolveWith(`Bearer ${await signFor('superusuario')}`)).toBeUndefined()
  })
})

/**
 * Cadastro de clientes: quem pode ler, quem pode escrever e quem pode mexer na configuração.
 *
 * Este teste é o único lugar que cobra a tradução papel → escopo do cadastro. Um papel novo que
 * ganhe acesso por descuido não aparece em nenhum outro teste — a rota do pacote só sabe cobrar o
 * escopo, não quem deveria tê-lo.
 */
describe('escopos do cadastro de clientes', () => {
  it('admin lê, escreve e configura', () => {
    const scopes = resolveScopesForRole(QUICKCART_ROLE.ADMIN)

    expect(scopes).toContain('customers:read')
    expect(scopes).toContain('customers:write')
    expect(scopes).toContain('customers:admin')
  })

  it('atendente lê e escreve, mas NÃO configura — lá se desliga a máscara de telefone', () => {
    const scopes = resolveScopesForRole(QUICKCART_ROLE.ATTENDANT)

    expect(scopes).toContain('customers:read')
    expect(scopes).toContain('customers:write')
    expect(scopes).not.toContain('customers:admin')
  })

  it('separador, motorista, cliente e serviço não acessam o cadastro', () => {
    for (const role of [
      QUICKCART_ROLE.PICKER,
      QUICKCART_ROLE.DRIVER,
      QUICKCART_ROLE.CUSTOMER,
      QUICKCART_ROLE.SERVICE,
    ]) {
      const scopes = resolveScopesForRole(role)

      expect(scopes.filter((scope) => scope.startsWith('customers:'))).toEqual([])
    }
  })
})
