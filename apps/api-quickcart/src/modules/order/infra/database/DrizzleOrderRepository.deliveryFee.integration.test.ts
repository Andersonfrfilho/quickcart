/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Taxa de entrega contra o Postgres de teste (spec §3.4). O que um fake não prova: que a reprecificação
 * por falta e por troca — feita em SQL — recalcula só `total_in_cents` e deixa `delivery_fee_in_cents`
 * intacta, e que a taxa nunca vira linha de `order_items` nem entra no total que a NFC-e usa.
 *
 * Mesma disciplina do `CreateWebOrder.use-case.integration.test.ts`: não fecha a conexão compartilhada e
 * apaga só os próprios registros.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { and, eq, inArray, like, notExists, sql } from 'drizzle-orm'

import { db } from '@/infra/database/connection'
import { categories, customers, orderItems, orders, products } from '@/infra/database/schema'
import { RedisProvider } from '@/infra/redis/RedisProvider'
import { generateId } from '@/shared/id'
import { DrizzleCategoryRepository } from '@/modules/catalog/infra/database/DrizzleCategoryRepository'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { DrizzleCustomerRepository } from '@/modules/webhook/infra/database/DrizzleCustomerRepository'
import { DrizzleOrderRepository } from '@/modules/order/infra/database/DrizzleOrderRepository'
import { CreateWebOrderUseCase } from '@/modules/order/application/use-cases/CreateWebOrder.use-case'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'

const DELIVERY_FEE_IN_CENTS = 800
const TEST_PHONE_PREFIX = '55117'

class NoopJobQueue implements JobQueue {
  async add(): Promise<unknown> {
    return undefined
  }
}

const categoryRepository = new DrizzleCategoryRepository()
const productRepository = new DrizzleProductRepository()
const orderRepository = new DrizzleOrderRepository()

const useCase = new CreateWebOrderUseCase({
  orderRepository,
  productRepository,
  customerRepository: new DrizzleCustomerRepository(),
  cacheProvider: new RedisProvider(),
  receiptQueue: new NoopJobQueue(),
  configuredDeliveryFeeInCents: DELIVERY_FEE_IN_CENTS,
})

const createdCategoryIds: string[] = []
const createdProductIds: string[] = []
const createdOrderIds: string[] = []
let phoneSequence = 0

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds))
    await db.delete(orders).where(inArray(orders.id, createdOrderIds))
  }
  if (createdProductIds.length > 0) await db.delete(products).where(inArray(products.id, createdProductIds))
  if (createdCategoryIds.length > 0) await db.delete(categories).where(inArray(categories.id, createdCategoryIds))
  await db.delete(customers).where(
    and(
      like(customers.phone, `${TEST_PHONE_PREFIX}%`),
      notExists(
        db
          .select({ one: sql`1` })
          .from(orders)
          .where(sql`${orders.customerId} = ${customers.id}`),
      ),
    ),
  )
})

async function createProduct(priceInCents: number): Promise<string> {
  const category = await categoryRepository.create({ id: generateId(), name: `Categoria Taxa ${generateId()}`, sortOrder: 1 })
  createdCategoryIds.push(category.id)

  const product = await productRepository.create({
    id: generateId(),
    categoryId: category.id,
    name: `Produto Taxa ${generateId()}`,
    unit: 'un',
    priceInCents,
    stockQuantity: 50,
    isAvailable: true,
    aliases: [],
  })
  createdProductIds.push(product.id)
  return product.id
}

function nextTestPhone(): string {
  phoneSequence += 1
  return `${TEST_PHONE_PREFIX}${(Date.now() % 1_000_000).toString().padStart(6, '0')}${phoneSequence.toString().padStart(3, '0')}`
}

async function createOrder(params: {
  readonly deliveryType: string
  readonly items: ReadonlyArray<{ readonly productId: string; readonly quantity: number }>
}): Promise<string> {
  const result = await useCase.execute({
    idempotencyKey: generateId(),
    customer: { name: 'Cliente Taxa', phone: nextTestPhone() },
    items: params.items,
    deliveryType: params.deliveryType,
    paymentMethod: 'pix',
    receiptPreference: 'whatsapp',
  })
  createdOrderIds.push(result.order.id)
  return result.order.id
}

async function readStoredOrder(orderId: string): Promise<{ totalInCents: number; deliveryFeeInCents: number; itemsSum: number; itemCount: number }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  const [items] = await db
    .select({
      itemsSum: sql<number>`coalesce(sum(${orderItems.totalInCents}) filter (where ${orderItems.unavailableAt} is null), 0)::int`,
      itemCount: sql<number>`count(*)::int`,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))

  return {
    totalInCents: order!.totalInCents,
    deliveryFeeInCents: order!.deliveryFeeInCents,
    itemsSum: items?.itemsSum ?? 0,
    itemCount: items?.itemCount ?? 0,
  }
}

describe('DrizzleOrderRepository — taxa de entrega fora do total', () => {
  test('entrega grava a taxa na coluna própria; total_in_cents é só a soma dos itens', async () => {
    const productA = await createProduct(1000)
    const productB = await createProduct(1000)

    const orderId = await createOrder({
      deliveryType: DELIVERY_TYPE.DELIVERY,
      items: [
        { productId: productA, quantity: 2 },
        { productId: productB, quantity: 1 },
      ],
    })
    const stored = await readStoredOrder(orderId)

    expect(stored.deliveryFeeInCents).toBe(DELIVERY_FEE_IN_CENTS)
    // Falha se a taxa passar a entrar no total: a NFC-e paga `total_in_cents`, que tem que bater com os itens.
    expect(stored.totalInCents).toBe(3000)
    expect(stored.totalInCents).toBe(stored.itemsSum)
    // Nenhuma linha representa a taxa: só os dois produtos pedidos.
    expect(stored.itemCount).toBe(2)
  })

  test('retirada grava taxa 0 mesmo com DELIVERY_FEE_CENTS configurada', async () => {
    const productA = await createProduct(1000)

    const orderId = await createOrder({ deliveryType: DELIVERY_TYPE.PICKUP, items: [{ productId: productA, quantity: 1 }] })

    expect((await readStoredOrder(orderId)).deliveryFeeInCents).toBe(0)
  })

  test('item em falta recalcula total_in_cents e preserva delivery_fee_in_cents', async () => {
    const productA = await createProduct(1000)
    const productB = await createProduct(1000)
    const orderId = await createOrder({
      deliveryType: DELIVERY_TYPE.DELIVERY,
      items: [
        { productId: productA, quantity: 2 },
        { productId: productB, quantity: 1 },
      ],
    })
    const missingItem = (await orderRepository.listItems(orderId)).find((item) => item.productId === productB)!

    await orderRepository.setItemUnavailable({ orderId, itemId: missingItem.id, unavailable: true })
    const stored = await readStoredOrder(orderId)

    expect(stored.totalInCents).toBe(2000)
    expect(stored.deliveryFeeInCents).toBe(DELIVERY_FEE_IN_CENTS)
  })

  test('substituição recalcula total_in_cents e preserva delivery_fee_in_cents', async () => {
    const productA = await createProduct(1000)
    const productB = await createProduct(1000)
    const substitute = await createProduct(1500)
    const orderId = await createOrder({
      deliveryType: DELIVERY_TYPE.DELIVERY,
      items: [
        { productId: productA, quantity: 2 },
        { productId: productB, quantity: 1 },
      ],
    })
    const missingItem = (await orderRepository.listItems(orderId)).find((item) => item.productId === productB)!
    await orderRepository.setItemUnavailable({ orderId, itemId: missingItem.id, unavailable: true })

    const result = await orderRepository.substituteItem({ orderId, orderItemId: missingItem.id, productId: substitute })
    const stored = await readStoredOrder(orderId)

    expect(result.ok).toBe(true)
    expect(stored.totalInCents).toBe(3500)
    expect(stored.totalInCents).toBe(stored.itemsSum)
    expect(stored.deliveryFeeInCents).toBe(DELIVERY_FEE_IN_CENTS)
  })
})
