/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Papel é vocabulário do produto, não do pacote: o `user-module` guarda `role` como string livre
 * e tem teste explícito garantindo que nenhum enum seja exportado de lá. O QuickCart declara os
 * seus aqui, e é esta lista que as rotas exigem.
 */

export const QUICKCART_ROLE = {
  /** Painel inteiro: catálogo, pedidos, conversas, configuração. */
  ADMIN: 'admin',
  /** Conversas e mensagens; não altera catálogo nem configuração. */
  ATTENDANT: 'atendente',
  /** Fila de separação: marca item separado, resolve substituição. */
  PICKER: 'separador',
  /** Entrega: vê o pedido que vai levar e atualiza o status de rota. */
  DRIVER: 'motorista',
  /** Cliente final da loja — vê e cria os próprios pedidos, nunca entra no painel. */
  CUSTOMER: 'cliente',
  /** Processo sem gente: o worker autentica com esta identidade para chamar a api. */
  SERVICE: 'servico',
} as const

export type QuickCartRole = (typeof QUICKCART_ROLE)[keyof typeof QUICKCART_ROLE]

/** Quem pode abrir o painel. `cliente` e `servico` ficam de fora de propósito. */
export const STAFF_ROLES: readonly QuickCartRole[] = [
  QUICKCART_ROLE.ADMIN,
  QUICKCART_ROLE.ATTENDANT,
  QUICKCART_ROLE.PICKER,
  QUICKCART_ROLE.DRIVER,
]
