/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Substitui o `requireAdminToken`: a rota deixa de aceitar um segredo compartilhado e passa a
 * exigir sessão de uma PESSOA, com papel.
 *
 * O que o token fixo não conseguia dar, e é o motivo da troca: saber QUEM agiu (trilha de auditoria
 * do `security.md` §10), revogar o acesso de um sem trocar o de todos, e recortar a rota por papel.
 */

import type { ParsedRequest } from '@/infra/http/router'
import { UnauthorizedError, ForbiddenError } from '@/shared/errors/AppError.error'
import { SESSION_INVALID, SESSION_ROLE_FORBIDDEN } from '@/shared/errors/codes'
import { extractBearerToken, isKnownRole } from '@/modules/user/infra/userAuthContextResolver'
import { getQuickCartUserModule } from '@/modules/user/infra/userModule'
import type { QuickCartRole } from '@/modules/user/shared/User.constant'
import type { UserModule } from '@adatechnology/user-module'

export type SessionContext = {
  readonly userId: string
  readonly email: string
  readonly role: QuickCartRole
}

export type RequireSessionParams = {
  readonly request: ParsedRequest
  /** Papéis que a rota aceita. Lista explícita sempre: não há hierarquia a inferir. */
  readonly roles: readonly QuickCartRole[]
  /** Injetável só para teste — em produção é sempre o módulo memoizado do boot. */
  readonly userModule?: UserModule
}

export async function requireSession({
  request,
  roles,
  userModule: injected,
}: RequireSessionParams): Promise<SessionContext> {
  const accessToken = extractBearerToken(request.headers['authorization'])
  if (!accessToken) throw new UnauthorizedError('Missing session token', SESSION_INVALID)

  const userModule = injected ?? (await getQuickCartUserModule())
  const claims = await userModule.verifyAccessToken(accessToken)
  if (!claims || !isKnownRole(claims.role)) {
    throw new UnauthorizedError('Invalid or expired session token', SESSION_INVALID)
  }

  // 403 e não 404: a sessão é legítima, o papel é que não alcança esta rota.
  if (!roles.includes(claims.role)) {
    throw new ForbiddenError('Role not allowed on this route', SESSION_ROLE_FORBIDDEN)
  }

  return { userId: claims.sub, email: claims.email, role: claims.role }
}
