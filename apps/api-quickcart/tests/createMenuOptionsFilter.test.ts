/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A regra é curta e o custo de errar é assimétrico: esconder demais tira uma opção que funcionava,
 * mostrar demais faz o menu prometer o que não existe. O que estes testes trancam é que o menu nunca
 * desapareça por completo — sem menu a conversa morre sem saída.
 */

import { describe, expect, it } from 'bun:test'
import { createMenuOptionsFilter } from '@/modules/conversation/application/createMenuOptionsFilter'
import { MENU_BUTTON_ID } from '@/modules/conversation/shared/Messages.constant'

const PHONE = '5511977770001'

const FULL_MENU = [
  [MENU_BUTTON_ID.SEND_LIST, '📝 Mandar minha lista'],
  [MENU_BUTTON_ID.REPEAT_ORDER, '🔁 Repetir última compra'],
  [MENU_BUTTON_ID.ORDER_HISTORY, '📜 Minhas últimas compras'],
  [MENU_BUTTON_ID.BROWSE, '🛒 Ver produtos da loja'],
  [MENU_BUTTON_ID.TALK_TO_AGENT, '💬 Falar com atendente'],
] as const

function createFilter(options: {
  customer?: { id: string } | undefined
  lastOrder?: { id: string } | undefined
  throwOnOrders?: boolean
}) {
  let orderLookups = 0

  const filter = createMenuOptionsFilter({
    customerRepository: { findByPhone: async () => options.customer } as never,
    orderRepository: {
      findLastByCustomer: async () => {
        orderLookups += 1
        if (options.throwOnOrders) throw new Error('banco fora')
        return options.lastOrder
      },
    } as never,
  })

  return { filter, orderLookups: () => orderLookups }
}

describe('createMenuOptionsFilter', () => {
  it('esconde repetir e histórico de quem nunca fechou pedido', async () => {
    const { filter } = createFilter({ customer: { id: 'c1' }, lastOrder: undefined })

    const options = await filter({ whatsappNumber: PHONE, options: FULL_MENU })
    const ids = options.map(([id]) => id)

    expect(ids).not.toContain(MENU_BUTTON_ID.REPEAT_ORDER)
    expect(ids).not.toContain(MENU_BUTTON_ID.ORDER_HISTORY)
    // O que não depende de histórico continua de pé — inclusive a saída para atendente.
    expect(ids).toEqual([MENU_BUTTON_ID.SEND_LIST, MENU_BUTTON_ID.BROWSE, MENU_BUTTON_ID.TALK_TO_AGENT])
  })

  it('mostra tudo para quem já comprou', async () => {
    const { filter } = createFilter({ customer: { id: 'c1' }, lastOrder: { id: 'o1' } })

    const options = await filter({ whatsappNumber: PHONE, options: FULL_MENU })

    expect(options).toHaveLength(FULL_MENU.length)
  })

  it('esconde também de quem ainda não é cliente', async () => {
    const { filter, orderLookups } = createFilter({ customer: undefined })

    const ids = (await filter({ whatsappNumber: PHONE, options: FULL_MENU })).map(([id]) => id)

    expect(ids).not.toContain(MENU_BUTTON_ID.REPEAT_ORDER)
    // Sem cliente não há o que consultar: não gasta consulta de pedido.
    expect(orderLookups()).toBe(0)
  })

  it('não consulta nada quando o nó não tem opção dependente de histórico', async () => {
    const { filter, orderLookups } = createFilter({ customer: { id: 'c1' } })
    const menuWithoutHistory = [[MENU_BUTTON_ID.SEND_LIST, '📝 Mandar minha lista']] as const

    const options = await filter({ whatsappNumber: PHONE, options: menuWithoutHistory })

    expect(options).toEqual(menuWithoutHistory)
    expect(orderLookups()).toBe(0)
  })

  it('mostra o menu inteiro se a leitura falhar', async () => {
    const { filter } = createFilter({ customer: { id: 'c1' }, throwOnOrders: true })

    // Menu a mais degrada para "não encontrei pedido anterior"; menu nenhum deixa o cliente sem saída.
    const options = await filter({ whatsappNumber: PHONE, options: FULL_MENU })

    expect(options).toHaveLength(FULL_MENU.length)
  })
})
