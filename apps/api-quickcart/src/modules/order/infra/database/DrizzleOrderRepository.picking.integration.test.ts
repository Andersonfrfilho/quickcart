/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A invariante entre separado e em falta, contra o Postgres de teste.
 *
 * O que um fake não prova: que o UPDATE que registra a falta apaga a separação do item na mesma
 * transação. Enquanto não apagava, um item pego às 14h e descoberto em falta às 14h05 carregava as duas
 * marcas, e a tela de separação anunciava "5/4 separados · 125%" — porque o numerador conta o que foi
 * marcado e o denominador só o que ainda existe.
 *
 * Mesma disciplina dos outros testes de integração: não fecha a conexão compartilhada e apaga só os
 * próprios registros.
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
import { DELIVERY_QUOTE_KIND, DELIVERY_LOCATION_SOURCE } from '@/modules/order/shared/DeliveryFeeQuote.constant'
import type { QuoteDeliveryFeeResult } from '@/modules/order/application/types/QuoteDeliveryFee.types'

const TEST_PHONE_PREFIX = '55118'

const categoryRepository = new DrizzleCategoryRepository()
const productRepository = new DrizzleProductRepository()
const orderRepository = new DrizzleOrderRepository()

const quoteDeliveryFeeUseCase = {
  execute: async (): Promise<QuoteDeliveryFeeResult> => ({
    kind: DELIVERY_QUOTE_KIND.QUOTED,
    feeInCents: 800,
    distanceKm: 2,
    tier: { maxDistanceKm: 3, feeInCents: 800 },
    source: DELIVERY_LOCATION_SOURCE.CEP,
  }),
}

const useCase = new CreateWebOrderUseCase({
  orderRepository,
  productRepository,
  customerRepository: new DrizzleCustomerRepository(),
  cacheProvider: new RedisProvider(),
  quoteDeliveryFeeUseCase,
  addressLookupProvider: {
    lookupByCep: async () => ({ street: 'Av. Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' }),
  },
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

async function createProduct(): Promise<string> {
  const category = await categoryRepository.create({
    id: generateId(),
    name: `Categoria Separacao ${generateId()}`,
    sortOrder: 1,
  })
  createdCategoryIds.push(category.id)

  const product = await productRepository.create({
    id: generateId(),
    categoryId: category.id,
    name: `Produto Separacao ${generateId()}`,
    unit: 'un',
    priceInCents: 1000,
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

async function createOrderWithTwoItems(): Promise<string> {
  const [firstProductId, secondProductId] = await Promise.all([createProduct(), createProduct()])

  const result = await useCase.execute({
    idempotencyKey: generateId(),
    customer: { name: 'Cliente Separacao', phone: nextTestPhone() },
    items: [
      { productId: firstProductId ?? '', quantity: 1 },
      { productId: secondProductId ?? '', quantity: 1 },
    ],
    deliveryType: DELIVERY_TYPE.DELIVERY,
    address: {
      cep: '01310-100',
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    paymentMethod: 'pix',
    receiptPreference: 'whatsapp',
  })
  createdOrderIds.push(result.order.id)
  return result.order.id
}

describe('separado e em falta se excluem', () => {
  test('registrar a falta apaga a separação do item', async () => {
    const orderId = await createOrderWithTwoItems()
    const before = await orderRepository.findDetailById(orderId)
    const item = before?.items[0]
    expect(item).toBeDefined()

    await orderRepository.setItemPicked({ orderId, itemId: item?.id ?? '', picked: true })
    const picked = await orderRepository.findDetailById(orderId)
    expect(picked?.items.find((candidate) => candidate.id === item?.id)?.pickedAt).not.toBeNull()

    await orderRepository.setItemUnavailable({ orderId, itemId: item?.id ?? '', unavailable: true })

    const after = await orderRepository.findDetailById(orderId)
    const marked = after?.items.find((candidate) => candidate.id === item?.id)
    expect(marked?.unavailableAt).not.toBeNull()
    expect(marked?.pickedAt).toBeNull()
  })

  test('o progresso nunca passa do total de itens que existem', async () => {
    const orderId = await createOrderWithTwoItems()
    const detail = await orderRepository.findDetailById(orderId)
    const missing = detail?.items[0]

    await orderRepository.setItemPicked({ orderId, itemId: missing?.id ?? '', picked: true })
    await orderRepository.setItemUnavailable({ orderId, itemId: missing?.id ?? '', unavailable: true })
    await orderRepository.setAllItemsPicked({ orderId, picked: true })

    const after = await orderRepository.findDetailById(orderId)
    const items = after?.items ?? []
    const available = items.filter((candidate) => candidate.unavailableAt === null)
    const pickedCount = items.filter((candidate) => candidate.pickedAt !== null).length

    expect(pickedCount).toBeLessThanOrEqual(available.length)
  })
})
