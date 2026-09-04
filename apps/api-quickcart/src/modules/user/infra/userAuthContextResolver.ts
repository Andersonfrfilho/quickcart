/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O ÚNICO lugar do produto que transforma um access token em identidade.
 *
 * A verificação em si é do pacote (`verifyAccessToken`), que assinou o token e conhece o segredo,
 * o emissor e o prazo — o host nunca toca `jose` nem decodifica JWT por conta própria. O que é do
 * host, e só dele, é traduzir `role` (vocabulário do QuickCart) em `scope` (vocabulário do
 * `module-http`).
 */

import type { AuthContextResolverPort } from '@adatechnology/module-http'
import type { UserModule } from '@adatechnology/user-module'

import { QUICKCART_ROLE } from '@/modules/user/shared/User.constant'
import type { QuickCartRole } from '@/modules/user/shared/User.constant'

const BEARER_PREFIX = 'Bearer '

export function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) return undefined
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : undefined
}

/**
 * O escopo que o `user-module` exige nas rotas de `/admin/users`.
 *
 * String literal porque o pacote NÃO a exporta — ela vive só dentro do `requiredScopes` das rotas
 * dele. E é `user:admin`, não `admin`: o campo `scope: 'admin'` da rota é a categoria, enquanto o
 * que o despachante compara é `requiredScopes`. Conceder `admin` dava 403 num admin legítimo, e o
 * typecheck não tinha como ver — só apareceu com a api de pé.
 */
const USER_MODULE_ADMIN_SCOPE = 'user:admin'

/**
 * O escopo administrativo sai de UM papel só. Todo papel autenticado ganha `user`; nenhum outro
 * ganha o de admin por herança, porque não há hierarquia de papéis neste produto — quem precisar
 * de mais escopo entra aqui explicitamente.
 */
/*
 * Escopos do cadastro de clientes, do pacote. Quem atende PRECISA ler a ficha de quem está do outro
 * lado da conversa e corrigir um nome errado; quem separa e quem entrega, não — eles trabalham
 * sobre o pedido, que já traz o endereço.
 *
 * `customers:admin` fica só no admin porque é lá que se desliga a máscara de telefone da listagem e
 * se muda o catálogo de campos — ação sensível, e não edição de ficha.
 */
const CUSTOMER_SCOPE_BY_ROLE: Readonly<Record<string, readonly string[]>> = {
  [QUICKCART_ROLE.ADMIN]: ['customers:read', 'customers:write', 'customers:admin'],
  [QUICKCART_ROLE.ATTENDANT]: ['customers:read', 'customers:write'],
}

export function resolveScopesForRole(role: string): readonly string[] {
  const scopes = ['user', role]
  if (role === QUICKCART_ROLE.ADMIN) scopes.push('admin', USER_MODULE_ADMIN_SCOPE)
  scopes.push(...(CUSTOMER_SCOPE_BY_ROLE[role] ?? []))
  return scopes
}

/** Papéis conhecidos do produto — um token com papel fora desta lista não abre rota nenhuma. */
export function isKnownRole(role: string): role is QuickCartRole {
  return Object.values(QUICKCART_ROLE).includes(role as QuickCartRole)
}

export type CreateUserAuthContextResolverParams = {
  readonly userModule: UserModule
  readonly companyId: string
}

export function createUserAuthContextResolver({
  userModule,
  companyId,
}: CreateUserAuthContextResolverParams): AuthContextResolverPort {
  return {
    async resolve({ headers }) {
      const accessToken = extractBearerToken(headers['authorization'])
      if (!accessToken) return undefined

      const claims = await userModule.verifyAccessToken(accessToken)
      if (!claims) return undefined
      if (!isKnownRole(claims.role)) return undefined

      return { companyId, userId: claims.sub, scopes: resolveScopesForRole(claims.role) }
    },
  }
}

