/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A sessão do worker na api. Substitui o `INTERNAL_API_TOKEN`, que era um segredo eterno com
 * permissão fixa — exatamente o que `security.md` §2 proíbe ("nenhum token estático e eterno").
 *
 * Um processo sem gente não tem quem relogue: por isso o token fica em memória, é renovado quando
 * vence e é descartado no primeiro 401, para a chamada seguinte reautenticar. Não há refresh token
 * aqui de propósito — o worker tem a credencial e pode simplesmente entrar de novo, e guardar um
 * refresh de longa vida em processo reiniciável não compraria nada.
 */

import { environment } from '@/infra/config/environment'

/** Renova um pouco antes do vencimento: o relógio do worker e o da api não são o mesmo. */
const EXPIRY_SAFETY_MARGIN_MS = 30_000

type CachedSession = {
  readonly accessToken: string
  readonly expiresAtMs: number
}

let cached: CachedSession | undefined

class ServiceAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function authenticate(): Promise<CachedSession> {
  const response = await fetch(`${environment.API_BASE_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: environment.WORKER_SERVICE_EMAIL,
      password: environment.WORKER_SERVICE_PASSWORD,
    }),
  })

  if (!response.ok) {
    // Sem o corpo no erro: ele carrega o e-mail da conta de serviço, e mensagem de erro vira log.
    throw new ServiceAuthError(`service_login_failed: ${response.status}`, response.status)
  }

  const { data } = (await response.json()) as { data: { accessToken: string; expiresInSeconds: number } }

  return {
    accessToken: data.accessToken,
    expiresAtMs: Date.now() + data.expiresInSeconds * 1000 - EXPIRY_SAFETY_MARGIN_MS,
  }
}

export async function getServiceAccessToken(): Promise<string> {
  if (cached && cached.expiresAtMs > Date.now()) return cached.accessToken

  cached = await authenticate()
  return cached.accessToken
}

/** Chamado no 401: o token em mãos não vale mais, e a próxima chamada precisa reautenticar. */
export function invalidateServiceSession(): void {
  cached = undefined
}
