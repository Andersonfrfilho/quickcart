/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O access token vive em MEMÓRIA, nunca em `localStorage` nem `sessionStorage` (security.md §8):
 * o que está no storage é legível por qualquer script que entre na página.
 *
 * Recarregar a aba perde o token, e é assim que tem de ser — quem restaura a sessão é o refresh
 * token, que mora num cookie `HttpOnly` que script nenhum lê. A troca é: um pedido a mais no boot
 * da página, em vez de um token exposto o tempo todo.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const REFRESH_PATH = '/v1/auth/refresh'

let accessToken: string | undefined
let refreshInFlight: Promise<string | undefined> | undefined

export function getAccessToken(): string | undefined {
  return accessToken
}

export function setAccessToken(token: string | undefined): void {
  accessToken = token
}

export function clearSession(): void {
  accessToken = undefined
  refreshInFlight = undefined
}

/**
 * Uma renovação por vez: sem isto, cinco pedidos que tomam 401 juntos disparam cinco refreshes, e
 * como o refresh token é ROTATIVO, o primeiro a chegar invalida os outros quatro — a sessão cai
 * justamente porque a tela estava ocupada.
 */
export function refreshSession(): Promise<string | undefined> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = undefined
  })
  return refreshInFlight
}

async function performRefresh(): Promise<string | undefined> {
  const response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, {
    method: 'POST',
    // O cookie do refresh só viaja com isto; sem `credentials`, o navegador não o anexa.
    credentials: 'include',
  })

  if (!response.ok) {
    accessToken = undefined
    return undefined
  }

  const body = (await response.json()) as { data: { accessToken: string } }
  accessToken = body.data.accessToken
  return accessToken
}
