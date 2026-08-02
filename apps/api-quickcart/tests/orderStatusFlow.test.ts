/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A esteira é a regra que protege o cliente de mensagem errada.
 *
 * Cada transição dispara aviso no WhatsApp de quem comprou, então um pulo indevido não erra só um campo no
 * banco: manda "saiu para entrega" de um pedido que ninguém separou, ou "aguardando confirmação" de uma
 * compra que já foi entregue. Enquanto a regra vivia no frontend, bastava uma aba velha para isso acontecer.
 */

import { describe, expect, it } from 'bun:test'
import { allowedNextStatuses, canTransitionTo } from '@/modules/order/domain/orderStatusFlow'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'

const delivery = { deliveryType: 'delivery' }
const pickup = { deliveryType: 'pickup' }

describe('allowedNextStatuses', () => {
  it('segue a esteira até a separação', () => {
    expect(allowedNextStatuses({ status: ORDER_STATUS.PENDING_CONFIRMATION, ...delivery })).toEqual([
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.CANCELLED,
    ])
    expect(allowedNextStatuses({ status: ORDER_STATUS.CONFIRMED, ...delivery })).toContain(ORDER_STATUS.PREPARING)
    expect(allowedNextStatuses({ status: ORDER_STATUS.PREPARING, ...delivery })).toContain(ORDER_STATUS.SEPARATED)
  })

  it('oferece só a saída que combina com o tipo de entrega', () => {
    // "Saiu para entrega" numa retirada deixaria a sacola no balcão com o cliente esperando em casa.
    expect(allowedNextStatuses({ status: ORDER_STATUS.SEPARATED, ...delivery })).toEqual([
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.CANCELLED,
    ])
    expect(allowedNextStatuses({ status: ORDER_STATUS.SEPARATED, ...pickup })).toEqual([
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.CANCELLED,
    ])
  })

  it('trata concluído e cancelado como fim de linha', () => {
    // Reabrir pedido concluído não é transição: é outra operação, e precisaria de nome e registro próprios.
    expect(allowedNextStatuses({ status: ORDER_STATUS.COMPLETED, ...delivery })).toEqual([])
    expect(allowedNextStatuses({ status: ORDER_STATUS.CANCELLED, ...delivery })).toEqual([])
  })

  it('não deixa cancelar depois de entregue', () => {
    expect(canTransitionTo({ status: ORDER_STATUS.COMPLETED, ...delivery, nextStatus: ORDER_STATUS.CANCELLED })).toBe(
      false,
    )
  })
})

describe('canTransitionTo', () => {
  it('recusa pulo de etapa', () => {
    // O caso que a tela impedia e a rota aceitava: pedido sem separação nenhuma "saindo para entrega".
    expect(
      canTransitionTo({
        status: ORDER_STATUS.PENDING_CONFIRMATION,
        ...delivery,
        nextStatus: ORDER_STATUS.OUT_FOR_DELIVERY,
      }),
    ).toBe(false)
  })

  it('recusa voltar no tempo', () => {
    expect(
      canTransitionTo({ status: ORDER_STATUS.COMPLETED, ...delivery, nextStatus: ORDER_STATUS.PENDING_CONFIRMATION }),
    ).toBe(false)
  })

  it('recusa status desconhecido em vez de deixar passar', () => {
    expect(canTransitionTo({ status: 'inventado', ...delivery, nextStatus: ORDER_STATUS.CONFIRMED })).toBe(false)
    expect(canTransitionTo({ status: ORDER_STATUS.CONFIRMED, ...delivery, nextStatus: 'inventado' })).toBe(false)
  })

  it('aceita o caminho normal', () => {
    expect(canTransitionTo({ status: ORDER_STATUS.CONFIRMED, ...delivery, nextStatus: ORDER_STATUS.PREPARING })).toBe(
      true,
    )
    expect(
      canTransitionTo({ status: ORDER_STATUS.SEPARATED, ...pickup, nextStatus: ORDER_STATUS.READY_FOR_PICKUP }),
    ).toBe(true)
  })
})
