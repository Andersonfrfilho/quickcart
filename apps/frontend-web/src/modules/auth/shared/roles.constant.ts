/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Espelha `QUICKCART_ROLE` da api. Duplicado de propósito: os dois apps são publicáveis de forma
 * independente, e um import atravessando `apps/` é o que a arquitetura proíbe. Se esta lista
 * crescer para além do rótulo, ela vira pacote em `packages/`.
 */

export const QUICKCART_ROLE = {
  ADMIN: 'admin',
  ATTENDANT: 'atendente',
  PICKER: 'separador',
  DRIVER: 'motorista',
  CUSTOMER: 'cliente',
  SERVICE: 'servico',
} as const

export type QuickCartRole = (typeof QUICKCART_ROLE)[keyof typeof QUICKCART_ROLE]

/** Rótulo que a tela mostra — o valor cru é vocabulário de sistema, não de gente. */
export const ROLE_LABEL: Readonly<Record<QuickCartRole, string>> = {
  [QUICKCART_ROLE.ADMIN]: 'Administrador',
  [QUICKCART_ROLE.ATTENDANT]: 'Atendente',
  [QUICKCART_ROLE.PICKER]: 'Separador',
  [QUICKCART_ROLE.DRIVER]: 'Motorista',
  [QUICKCART_ROLE.CUSTOMER]: 'Cliente',
  [QUICKCART_ROLE.SERVICE]: 'Serviço',
}

export const STAFF_ROLES: readonly QuickCartRole[] = [
  QUICKCART_ROLE.ADMIN,
  QUICKCART_ROLE.ATTENDANT,
  QUICKCART_ROLE.PICKER,
  QUICKCART_ROLE.DRIVER,
]

export const ADMIN_ONLY: readonly QuickCartRole[] = [QUICKCART_ROLE.ADMIN]
export const ADMIN_AND_ATTENDANT: readonly QuickCartRole[] = [QUICKCART_ROLE.ADMIN, QUICKCART_ROLE.ATTENDANT]
