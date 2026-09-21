/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Os dois caminhos do aviso de falta, e o que diferencia um do outro é o que acontece DEPOIS da mensagem:
 * perguntar tira o pedido da esteira e liga o relógio da cobrança; informar não encosta no status, para que
 * quem está com a sacola feche a separação sem esperar ninguém.
 */

import { describe, expect, it } from 'bun:test'
import { AskUnavailableItemsUseCase } from '@/modules/order/application/use-cases/AskUnavailableItems.use-case'
import { NotifyUnavailableItemsUseCase } from '@/modules/order/application/use-cases/NotifyUnavailableItems.use-case'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type {
  OrderDetail,
  OrderItemRecord,
  OrderRecord,
  OrderRepositoryInterface,
} from '@/modules/order/domain/OrderRepository.interface'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import { OrderCustomerApprovalRequiredError } from '@/shared/errors/OrderErrors'

const ORDER_ID = 'order-1'

function buildItem(overrides: Partial<OrderItemRecord> = {}): OrderItemRecord {
  return {
    id: 'item-1',
    orderId: ORDER_ID,
    productId: 'product-1',
    productName: 'Arroz 5kg',
    unitPriceInCents: 2500,
    quantity: 1,
    totalInCents: 2500,
    unavailableAt: null,
    unavailableNotifiedAt: null,
    pickedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildDetail(items: OrderItemRecord[], status: string = ORDER_STATUS.PREPARING): OrderDetail {
  return {
    order: {
      id: ORDER_ID,
      shortCode: 'QC-1000',
      customerId: 'customer-1',
      cartId: null,
      channel: 'whatsapp',
      status,
      totalInCents: items.filter((item) => item.unavailableAt === null).reduce((sum, item) => sum + item.totalInCents, 0),
      deliveryType: 'delivery',
      address: null,
      legacyAddressText: null,
      paymentMethod: 'pix',
      receiptPreference: 'whatsapp',
      fiscalDocumentId: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customerName: 'Cliente',
      customerPhone: '5511999999999',
    } as OrderRecord & { readonly customerName: string | null; readonly customerPhone: string },
    items,
  }
}

type Calls = {
  readonly asked: { readonly body: string; readonly buttons: readonly { readonly id: string }[] }[]
  readonly notified: { readonly body: string }[]
  readonly reminded: string[]
  readonly decisionStarted: string[]
}

/**
 * Só os métodos que este caso de uso toca.
 *
 * Implementar a interface inteira aqui seria vinte métodos que nenhum teste chama, e cada método novo do
 * repositório quebraria um arquivo que não tem nada a ver com ele.
 */
function buildUseCase(params: {
  readonly items: OrderItemRecord[]
  readonly status?: string
  readonly decisionMoves?: boolean
}) {
  const calls: Calls = { asked: [], notified: [], reminded: [], decisionStarted: [] }
  const detail = buildDetail(params.items, params.status ?? ORDER_STATUS.PREPARING)

  const orderRepository = {
    findDetailById: async () => detail,
    markUnavailableItemsNotified: async () => params.items.filter((item) => item.unavailableAt !== null),
    startCustomerDecision: async ({ orderId }: { readonly orderId: string }) => {
      calls.decisionStarted.push(orderId)
      return params.decisionMoves === false ? undefined : detail.order
    },
  } as unknown as OrderRepositoryInterface

  const askCustomer = async ({ body, buttons }: { readonly body: string; readonly buttons: readonly { readonly id: string }[] }) => {
    calls.asked.push({ body, buttons })
  }

  /* Sem parecido no catálogo, a pergunta que sai é a do pedido inteiro — que é o que estes testes cobrem. */
  const askUnavailableItemsUseCase = new AskUnavailableItemsUseCase({
    orderRepository,
    productRepository: { findSubstituteCandidate: async () => undefined } as unknown as ProductRepositoryInterface,
    askCustomer,
  })

  const useCase = new NotifyUnavailableItemsUseCase({
    orderRepository,
    askUnavailableItemsUseCase,
    notifyCustomer: async ({ body }) => {
      calls.notified.push({ body })
    },
    scheduleDecisionReminder: async ({ orderId }) => {
      calls.reminded.push(orderId)
    },
  })

  return { useCase, calls }
}

describe('NotifyUnavailableItemsUseCase', () => {
  it('com aprovação: pergunta com botões, para o pedido e agenda a cobrança', async () => {
    const { useCase, calls } = buildUseCase({
      items: [buildItem(), buildItem({ id: 'item-2', productName: 'Feijão', unavailableAt: new Date() })],
    })

    const result = await useCase.execute({ orderId: ORDER_ID, requiresCustomerApproval: true })

    expect(result.notifiedCount).toBe(1)
    expect(calls.asked).toHaveLength(1)
    expect(calls.asked[0]?.body).toContain('Feijão')
    expect(calls.asked[0]?.buttons.length).toBeGreaterThan(0)
    expect(calls.notified).toHaveLength(0)
    expect(calls.decisionStarted).toEqual([ORDER_ID])
    expect(calls.reminded).toEqual([ORDER_ID])
  })

  it('sem aprovação: informa em texto puro, e o pedido não sai do lugar', async () => {
    const { useCase, calls } = buildUseCase({
      items: [buildItem(), buildItem({ id: 'item-2', productName: 'Feijão', unavailableAt: new Date() })],
    })

    const result = await useCase.execute({ orderId: ORDER_ID, requiresCustomerApproval: false })

    expect(result.notifiedCount).toBe(1)
    expect(calls.notified).toHaveLength(1)
    expect(calls.notified[0]?.body).toContain('Feijão')
    expect(calls.asked).toHaveLength(0)
    // O que libera "Marcar como separado": sem desvio e sem relógio, a separação continua de onde estava.
    expect(calls.decisionStarted).toEqual([])
    expect(calls.reminded).toEqual([])
  })

  it('sem aprovação e sem nada para entregar: recusa, porque a decisão é do cliente', async () => {
    const { useCase, calls } = buildUseCase({
      items: [buildItem({ unavailableAt: new Date() })],
    })

    await expect(useCase.execute({ orderId: ORDER_ID, requiresCustomerApproval: false })).rejects.toBeInstanceOf(
      OrderCustomerApprovalRequiredError,
    )
    // Recusa antes de falar: seguir sem sobra entregaria sacola vazia, e o recado não pode ser desmandado.
    expect(calls.notified).toHaveLength(0)
    expect(calls.asked).toHaveLength(0)
  })

  it('não manda nada quando toda falta já foi avisada — dois cliques, um recado', async () => {
    const { useCase, calls } = buildUseCase({
      items: [buildItem({ unavailableAt: new Date(), unavailableNotifiedAt: new Date() }), buildItem({ id: 'item-2' })],
    })

    const result = await useCase.execute({ orderId: ORDER_ID, requiresCustomerApproval: true })

    expect(result.notifiedCount).toBe(0)
    expect(calls.asked).toHaveLength(0)
    expect(calls.notified).toHaveLength(0)
  })

  it('não agenda cobrança quando o pedido saiu do estado esperado entre a leitura e a escrita', async () => {
    const { useCase, calls } = buildUseCase({
      items: [buildItem(), buildItem({ id: 'item-2', unavailableAt: new Date() })],
      decisionMoves: false,
    })

    await useCase.execute({ orderId: ORDER_ID, requiresCustomerApproval: true })

    // A pergunta saiu (não dá para desmandar), mas cobrar sobre um pedido que a loja já cancelou seria pior.
    expect(calls.asked).toHaveLength(1)
    expect(calls.reminded).toEqual([])
  })
})
