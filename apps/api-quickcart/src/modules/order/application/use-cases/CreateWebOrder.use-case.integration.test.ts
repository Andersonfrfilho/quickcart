/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Testes de concorrência real (T5.6) — Postgres + Redis de teste, sem fakes.
 * Cobre corrida de estoque, restauração ao cancelar e corrida de Idempotency-Key,
 * cenários que fakes em memória não conseguem revelar pois dependem de I/O real
 * (transação do Postgres, `SET NX` do Redis) sob concorrência genuína.
 *
 * Requer Postgres/Redis de teste no ar e migrados — rodar via `make validate`
 * ou `bun --env-file=../../envs/env.test test`.
 *
 * Não fecha o pool/conexão no afterAll: `db`/`redis` são singletons
 * compartilhados por todo o processo `bun test`, e outros arquivos de teste
 * de integração rodam no mesmo processo — fechar aqui quebraria os demais.
 *
 * Limpa os próprios registros no afterAll: o catálogo de teste é compartilhado
 * com `DrizzleProductRepository.test.ts` (busca trigram sobre o seed real) —
 * deixar produtos/categorias órfãos aqui poluiria o ranking daquele teste.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { and, inArray, like, notExists, sql } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { categories, customers, orderItems, orders, products } from '@/infra/database/schema'
import { RedisProvider } from '@/infra/redis/RedisProvider'
import { generateId } from '@/shared/id'
import { OrderIdempotencyConflictError } from '@/shared/errors/OrderErrors'
import { DrizzleCategoryRepository } from '@/modules/catalog/infra/database/DrizzleCategoryRepository'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { DrizzleCustomerRepository } from '@/modules/webhook/infra/database/DrizzleCustomerRepository'
import { DrizzleOrderRepository } from '@/modules/order/infra/database/DrizzleOrderRepository'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import { CreateWebOrderUseCase } from './CreateWebOrder.use-case'
import type { CreateWebOrderParams } from '../types/CreateWebOrder.types'

class NoopJobQueue implements JobQueue {
  async add(): Promise<unknown> {
    return undefined
  }
}

const categoryRepository = new DrizzleCategoryRepository()
const productRepository = new DrizzleProductRepository()
const customerRepository = new DrizzleCustomerRepository()
const orderRepository = new DrizzleOrderRepository()
const cacheProvider = new RedisProvider()
const receiptQueue = new NoopJobQueue()

const useCase = new CreateWebOrderUseCase({
  orderRepository,
  productRepository,
  customerRepository,
  cacheProvider,
  receiptQueue,
})

const TEST_PHONE_PREFIX = '55119'

const createdCategoryIds: string[] = []
const createdProductIds: string[] = []
const createdOrderIds: string[] = []

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds))
    await db.delete(orders).where(inArray(orders.id, createdOrderIds))
  }
  if (createdProductIds.length > 0) await db.delete(products).where(inArray(products.id, createdProductIds))
  if (createdCategoryIds.length > 0) await db.delete(categories).where(inArray(categories.id, createdCategoryIds))
  /**
   * Cobre clientes de requisições perdedoras (a use-case faz upsert do cliente antes de checar
   * estoque, então até pedidos que falham criam um customer).
   *
   * Só os SEM pedido: varrer o prefixo inteiro reivindicava a faixa de telefones toda, e os seeds
   * de entrega criam clientes nessa mesma faixa COM pedido. Numa base recém-semeada a limpeza
   * violava `orders_customer_id_customers_id_fk` e derrubava o arquivo inteiro — cliente com pedido
   * não é deste teste para apagar.
   */
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

async function createProduct(stockQuantity: number): Promise<string> {
  const category = await categoryRepository.create({
    id: generateId(),
    name: `Categoria Teste ${generateId()}`,
    sortOrder: 1,
  })
  createdCategoryIds.push(category.id)

  const product = await productRepository.create({
    id: generateId(),
    categoryId: category.id,
    name: `Produto Teste ${generateId()}`,
    unit: 'un',
    priceInCents: 1000,
    stockQuantity,
    isAvailable: true,
    aliases: [],
  })
  createdProductIds.push(product.id)

  return product.id
}

let phoneSequence = 0

function nextTestPhone(): string {
  phoneSequence += 1
  return `${TEST_PHONE_PREFIX}${(Date.now() % 1_000_000).toString().padStart(6, '0')}${phoneSequence.toString().padStart(3, '0')}`
}

function buildParams(overrides: Partial<CreateWebOrderParams> & { productId: string; quantity: number }): CreateWebOrderParams {
  return {
    idempotencyKey: overrides.idempotencyKey ?? generateId(),
    customer: overrides.customer ?? { name: 'Cliente Teste', phone: nextTestPhone() },
    items: [{ productId: overrides.productId, quantity: overrides.quantity }],
    deliveryType: 'pickup',
    paymentMethod: 'cash',
    receiptPreference: 'whatsapp',
  }
}

function trackResult<T extends { order: { id: string } }>(result: T): T {
  createdOrderIds.push(result.order.id)
  return result
}

describe('CreateWebOrderUseCase — concorrência real (Postgres + Redis)', () => {
  test('duas requisições concorrentes competindo pelo mesmo estoque: só uma decrementa com sucesso', async () => {
    const productId = await createProduct(5)

    const [firstResult, secondResult] = await Promise.allSettled([
      useCase.execute(buildParams({ productId, quantity: 5 })),
      useCase.execute(buildParams({ productId, quantity: 5 })),
    ])

    const succeeded = [firstResult, secondResult].filter((result) => result.status === 'fulfilled')
    const failed = [firstResult, secondResult].filter((result) => result.status === 'rejected')

    expect(succeeded).toHaveLength(1)
    expect(failed).toHaveLength(1)

    if (succeeded[0]?.status === 'fulfilled') trackResult(succeeded[0].value)

    const finalProduct = await productRepository.findById(productId)
    expect(finalProduct?.stockQuantity).toBe(0)
  })

  test('cancelar um pedido restaura o estoque do produto', async () => {
    const productId = await createProduct(10)

    const result = trackResult(await useCase.execute(buildParams({ productId, quantity: 4 })))
    const afterOrder = await productRepository.findById(productId)
    expect(afterOrder?.stockQuantity).toBe(6)

    await orderRepository.cancelAndRestoreStock(result.order.id)

    const afterCancel = await productRepository.findById(productId)
    expect(afterCancel?.stockQuantity).toBe(10)
  })

  test('duas requisições concorrentes com a mesma Idempotency-Key criam apenas um pedido', async () => {
    const productId = await createProduct(20)
    const idempotencyKey = generateId()
    const params = buildParams({ productId, quantity: 2, idempotencyKey })

    const [firstResult, secondResult] = await Promise.all([useCase.execute(params), useCase.execute(params)])
    trackResult(firstResult)

    expect(secondResult.order.id).toBe(firstResult.order.id)
    expect(secondResult.order.shortCode).toBe(firstResult.order.shortCode)

    const finalProduct = await productRepository.findById(productId)
    expect(finalProduct?.stockQuantity).toBe(18)
  })
})

describe('CreateWebOrderUseCase — timeout de espera na Idempotency-Key', () => {
  const STUCK_KEY = 'stuck-idempotency-key-integration-test'

  beforeEach(async () => {
    await cacheProvider.setIfNotExists(`order:idempotency:${STUCK_KEY}`, 'pending', 2)
  })

  test('lança OrderIdempotencyConflictError quando a reserva nunca é liberada', async () => {
    const productId = await createProduct(1)

    await expect(useCase.execute(buildParams({ productId, quantity: 1, idempotencyKey: STUCK_KEY }))).rejects.toBeInstanceOf(
      OrderIdempotencyConflictError,
    )
  }, 10000)
})
