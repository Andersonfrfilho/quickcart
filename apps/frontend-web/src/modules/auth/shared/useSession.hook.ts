/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A guarda de rota do painel. Substitui `useRequireAdmin`, que só sabia perguntar "existe token?" —
 * com sessão de pessoa a pergunta passa a ser "este papel alcança esta tela?".
 *
 * A guarda é conveniência de navegação, não segurança: quem decide é a api, que valida o papel em
 * toda requisição (`web.md` §13 — feature flag não substitui autorização). Esconder o menu sem
 * checar no servidor seria teatro.
 */

import { useEffect, useState } from 'react'
import { useUser, SESSION_STATUS } from '@adatechnology/user-ui'

import { useRouter } from '@/app/router'
import type { QuickCartRole } from '@/modules/auth/shared/roles.constant'

import { getAccessToken, refreshSession } from './sessionStore'

export { getAccessToken } from './sessionStore'

const SIGN_IN_PATH = '/admin'

export type StaffSession = {
  readonly isReady: boolean
  readonly role: QuickCartRole | undefined
}

export function useRequireStaff(allowedRoles: readonly QuickCartRole[]): StaffSession {
  const { navigate } = useRouter()
  const { status, user } = useUser()

  useEffect(() => {
    // `loading` é "ainda não sei": redirecionar aqui expulsaria quem está com a sessão sendo restaurada.
    if (status === SESSION_STATUS.LOADING) return
    if (status !== SESSION_STATUS.AUTHENTICATED || !user) {
      navigate(SIGN_IN_PATH)
      return
    }
    if (!allowedRoles.includes(user.role as QuickCartRole)) navigate(SIGN_IN_PATH)
  }, [status, user, allowedRoles, navigate])

  return { isReady: status === SESSION_STATUS.AUTHENTICATED, role: user?.role as QuickCartRole | undefined }
}

/**
 * Restaura a sessão no primeiro render da aba: o access token vive em memória e some no reload, e
 * é o cookie `HttpOnly` do refresh que o traz de volta. Sem isto, recarregar o painel deslogaria.
 */
export function useRestoreSession(): boolean {
  const [isSettled, setIsSettled] = useState(() => getAccessToken() !== undefined)

  useEffect(() => {
    if (isSettled) return
    let isMounted = true
    refreshSession().finally(() => {
      if (isMounted) setIsSettled(true)
    })
    return () => {
      isMounted = false
    }
  }, [isSettled])

  return isSettled
}
