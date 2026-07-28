/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cliente HTTP das rotas administrativas. Extraído para cá porque conversas, mensagens e fluxos
 * compartilham envelope (`{ data }`), autenticação por token e formato de erro — três cópias da
 * mesma função divergiriam no primeiro ajuste de envelope.
 */

// Lê pelo mesmo acessor que o login usa para gravar. Ler o storage direto aqui já tinha causado
// divergência real: o login grava em sessionStorage e o cliente lia localStorage, então toda
// chamada saía com token vazio.
import { getAdminToken } from '@/modules/admin/shared/useAdminAuth.hook'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ADMIN_BASE_PATH = '/v1/admin'
const NO_CONTENT = 204

export async function adminRequest<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${ADMIN_BASE_PATH}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() ?? ''}`,
      ...init?.headers,
    },
  })

  if (!response.ok) {
    // A API responde { error: { code, message } }; preservar a mensagem é o que faz o toast dizer
    // algo útil em vez de "erro inesperado".
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Falha na requisição (${response.status})`)
  }

  if (response.status === NO_CONTENT) return undefined as TResponse

  const body = (await response.json()) as { data: TResponse }
  return body.data
}

export function buildAdminQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}
