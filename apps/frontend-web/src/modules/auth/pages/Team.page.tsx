import React from 'react'
import { TeamWorkspace } from '@adatechnology/user-ui'
import type { TeamRoleOption } from '@adatechnology/user-ui'

import { useRequireStaff } from '@/modules/auth/shared/useSession.hook'
import { ADMIN_ONLY, QUICKCART_ROLE, ROLE_LABEL } from '@/modules/auth/shared/roles.constant'

/**
 * A tela COMPOSTA do pacote, consumida inteira — não remontada a partir dos formulários soltos.
 *
 * Os papéis é que são do produto: o `user-module` guarda `role` como string livre justamente para
 * cada host declarar o seu, e o `user-ui` passou a aceitar essa lista a partir da 0.2.0.
 *
 * `cliente` e `servico` ficam de fora de propósito: cliente se cadastra sozinho pela loja, e a conta
 * de serviço do worker nasce da semeadura de boot. Nenhum dos dois é gente a contratar por aqui.
 */
const ASSIGNABLE_ROLES: readonly TeamRoleOption[] = [
  { value: QUICKCART_ROLE.ATTENDANT, label: ROLE_LABEL[QUICKCART_ROLE.ATTENDANT] },
  { value: QUICKCART_ROLE.PICKER, label: ROLE_LABEL[QUICKCART_ROLE.PICKER] },
  { value: QUICKCART_ROLE.DRIVER, label: ROLE_LABEL[QUICKCART_ROLE.DRIVER] },
  { value: QUICKCART_ROLE.ADMIN, label: ROLE_LABEL[QUICKCART_ROLE.ADMIN], tone: 'accent' },
]

export function TeamPage() {
  const { isReady } = useRequireStaff(ADMIN_ONLY)

  if (!isReady) return null

  return <TeamWorkspace roles={ASSIGNABLE_ROLES} />
}
