import React from 'react'
import { SignInScreen, ForgotPasswordScreen, useUser, SESSION_STATUS } from '@adatechnology/user-ui'

import { useRouter } from '@/app/router'
import { STAFF_ROLES } from '@/modules/auth/shared/roles.constant'
import type { QuickCartRole } from '@/modules/auth/shared/roles.constant'

const PANEL_HOME_PATH = '/admin/orders'
const STORE_ORDERS_PATH = '/meus-pedidos'

/**
 * Um login para os dois públicos: o destino depois de entrar é que difere. Quem é do painel vai
 * para a fila de pedidos; o cliente final vai para os próprios pedidos, e nunca para o painel.
 */
function resolveDestination(role: QuickCartRole | undefined): string {
  return role && STAFF_ROLES.includes(role) ? PANEL_HOME_PATH : STORE_ORDERS_PATH
}

export function SignInPage() {
  const { navigate } = useRouter()
  const { status, user } = useUser()
  const [isRecovering, setIsRecovering] = React.useState(false)

  /*
   * Navegar por efeito, e não dentro do `onSignedIn`: o callback dispara junto com a atualização da
   * sessão, e ler `user` do closure ali pegaria o valor do render ANTERIOR — que ainda é `undefined`,
   * mandando todo mundo para a loja, inclusive o admin.
   */
  React.useEffect(() => {
    if (status !== SESSION_STATUS.AUTHENTICATED) return
    navigate(resolveDestination(user?.role as QuickCartRole | undefined))
  }, [status, user, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {isRecovering ? (
        <ForgotPasswordScreen onBackToSignIn={() => setIsRecovering(false)} />
      ) : (
        <SignInScreen onForgotPassword={() => setIsRecovering(true)} />
      )}
    </div>
  )
}
