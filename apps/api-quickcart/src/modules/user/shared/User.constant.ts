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

/*
 * Conjuntos de papéis por tipo de rota. Declarar aqui, e não em cada controller, é o que impede
 * duas rotas equivalentes de divergirem em quem pode chamá-las.
 */

/** Catálogo, configuração de conversa, integrações: mexer aqui muda a operação inteira. */
export const ADMIN_ONLY: readonly QuickCartRole[] = [QUICKCART_ROLE.ADMIN]

/** Conversas e mensagens com o cliente — é o trabalho do atendente. */
export const ADMIN_AND_ATTENDANT: readonly QuickCartRole[] = [QUICKCART_ROLE.ADMIN, QUICKCART_ROLE.ATTENDANT]

/** Leitura da fila de pedidos: todo mundo que trabalha no pedido precisa vê-lo. */
export const ORDER_READERS: readonly QuickCartRole[] = STAFF_ROLES

/** Separação: quem monta a sacola e resolve item em falta. */
export const ORDER_PICKERS: readonly QuickCartRole[] = [QUICKCART_ROLE.ADMIN, QUICKCART_ROLE.PICKER]

/** Status do pedido: o separador avança até "pronto", o motorista dali até "entregue". */
export const ORDER_STATUS_WRITERS: readonly QuickCartRole[] = [
  QUICKCART_ROLE.ADMIN,
  QUICKCART_ROLE.PICKER,
  QUICKCART_ROLE.DRIVER,
]

/** Avisar o cliente sobre item em falta é conversa, e o atendente também faz. */
export const ORDER_NOTIFIERS: readonly QuickCartRole[] = [
  QUICKCART_ROLE.ADMIN,
  QUICKCART_ROLE.ATTENDANT,
  QUICKCART_ROLE.PICKER,
]
