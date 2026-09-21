/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `UserApi` é porta do `user-ui`, e o pacote não traz cliente HTTP de propósito: quem sabe a URL
 * da api, o envelope e o tratamento de erro é o host. Isto é a implementação do QuickCart.
 *
 * As capacidades opcionais existem por PRESENÇA: `listTeam` e `createTeamMember` estão aqui porque
 * a api publica `/v1/admin/users`; `setOwnAvatar` não está porque o QuickCart não plugou
 * armazenamento de foto, e o `user-ui` simplesmente não desenha o controle.
 */

// Os tipos vêm do `user-ui`, NÃO do `user-contracts`: o pacote de contratos modela o lado servidor,
// onde `lastSeenAt` é `Date`; o que chega na tela é JSON, e ali o mesmo campo é string.
import type { UserApi, UserProfile, UserSession } from '@adatechnology/user-ui'

type PaginatedResponse<T> = {
  readonly data: readonly T[]
  readonly pagination: { readonly total: number; readonly page: number; readonly perPage: number }
}

import { getAccessToken, setAccessToken, clearSession, refreshSession } from './sessionStore'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const UNAUTHORIZED_STATUS = 401
const NO_CONTENT_STATUS = 204

class UserApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
  }
}

type RequestParams = {
  readonly path: string
  readonly method?: string
  readonly body?: unknown
  /** Rota de sessão (login, refresh, reset) não leva token e não deve tentar renovar. */
  readonly authenticated?: boolean
}

async function send({ path, method = 'GET', body, authenticated = true }: RequestParams): Promise<Response> {
  const token = authenticated ? getAccessToken() : undefined

  return fetch(`${API_BASE_URL}/v1${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function request<TResponse>(params: RequestParams): Promise<TResponse> {
  let response = await send(params)

  // Uma renovação e uma repetição: o access token dura 15 minutos, e a aba aberta atravessa isso.
  if (response.status === UNAUTHORIZED_STATUS && params.authenticated !== false) {
    const renewed = await refreshSession()
    if (renewed) response = await send(params)
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string; code?: string } }
      | null
    throw new UserApiError(
      payload?.error?.message ?? `Falha na requisição (${response.status})`,
      response.status,
      payload?.error?.code,
    )
  }

  if (response.status === NO_CONTENT_STATUS) return undefined as TResponse
  return (await response.json()) as TResponse
}

export const quickCartUserApi: UserApi = {
  async signIn({ email, password }) {
    const { data } = await request<{ data: UserSession }>({
      path: '/auth/login',
      method: 'POST',
      body: { email, password },
      authenticated: false,
    })
    setAccessToken(data.accessToken)
    return data
  },

  async signOut() {
    // O corpo vazio é intencional: o refresh token vem do cookie, não do payload.
    await request<void>({ path: '/auth/logout', method: 'POST' })
    clearSession()
  },

  async getProfile() {
    const { data } = await request<{ data: UserProfile }>({ path: '/auth/me' })
    return data
  },

  async updateProfile(input) {
    const { data } = await request<{ data: UserProfile }>({
      path: '/auth/profile',
      method: 'PATCH',
      body: input,
    })
    return data
  },

  async requestPasswordReset(email) {
    await request<void>({
      path: '/auth/password-reset/request',
      method: 'POST',
      body: { email },
      authenticated: false,
    })
  },

  async confirmPasswordReset({ token, newPassword }) {
    await request<void>({
      path: '/auth/password-reset/confirm',
      method: 'POST',
      body: { token, newPassword },
      authenticated: false,
    })
  },

  async listTeam({ page, pageSize }) {
    // Esta rota devolve o envelope paginado na RAIZ, sem `{ data: … }` em volta.
    const body = await request<PaginatedResponse<UserProfile>>({
      path: `/admin/users?page=${page}&perPage=${pageSize}`,
    })
    return {
      items: body.data,
      total: body.pagination.total,
      page: body.pagination.page,
      pageSize: body.pagination.perPage,
    }
  },

  async createTeamMember(input) {
    const { data } = await request<{ data: UserProfile }>({
      path: '/admin/users',
      method: 'POST',
      body: input,
    })
    return data
  },
}
