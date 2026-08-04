/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cria os pedidos de desenvolvimento pelo `CreateWebOrderUseCase` — o mesmo caminho do checkout do
 * site, com a mesma validação de endereço estruturado (`code-standart.md` §5: seed roda use-case,
 * nunca INSERT bruto). Um endereço que a seed conseguisse gravar e o checkout recusaria seria uma
 * mentira útil só para enganar a própria tela.
 *
 * Duas dependências são dubladas aqui de propósito, e nenhuma delas altera o pedido gravado:
 *
 * - A fila de recibo vira no-op. Seed não deve emitir nota nem mandar WhatsApp para cliente fictício;
 *   com o worker rodando, seis pedidos gerariam seis PDFs e seis mensagens.
 * - O cache de idempotência vira um Map em memória. A chave só serve para uma repetição da MESMA
 *   requisição, e uma seed não repete — usar o Redis de verdade sujaria o ambiente com chaves de 24h.
 */

import { CreateWebOrderUseCase } from '@/modules/order/application/use-cases/CreateWebOrder.use-case'
import { DrizzleOrderRepository } from '@/modules/order/infra/database/DrizzleOrderRepository'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { DrizzleCustomerRepository } from '@/modules/webhook/infra/database/DrizzleCustomerRepository'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { JobQueue } from '@/modules/order/domain/JobQueue.interface'
import { generateId } from '@/shared/id'
import { logger } from '@/shared/logger'
import { SEED_ORDER_CUSTOMERS } from './OrderSeedCustomers'

const log = logger.child('OrderSeed')

/** Fila que não enfileira: seed não manda recibo para cliente que não existe. */
const noOpReceiptQueue: JobQueue = {
  async add() {
    return undefined
  },
}

class InMemoryCacheProvider implements CacheProvider {
  private readonly entries = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.entries.set(key, value)
  }

  async setIfNotExists(key: string, value: string): Promise<boolean> {
    if (this.entries.has(key)) return false
    this.entries.set(key, value)
    return true
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    return this.entries.has(key)
  }
}

export async function seedOrders(): Promise<void> {
  const orderRepository = new DrizzleOrderRepository()
  const productRepository = new DrizzleProductRepository()
  const customerRepository = new DrizzleCustomerRepository()

  const createWebOrderUseCase = new CreateWebOrderUseCase({
    orderRepository,
    productRepository,
    customerRepository,
    cacheProvider: new InMemoryCacheProvider(),
    receiptQueue: noOpReceiptQueue,
  })

  const catalog = await productRepository.list({
    onlyAvailable: true,
    page: 1,
    perPage: 60,
    sortBy: 'name',
    sortDirection: 'asc',
  })

  if (catalog.items.length === 0) {
    log.warn('orders_seed_skipped', { reason: 'catalogo_vazio' })
    return
  }

  let created = 0
  let skipped = 0

  for (const [index, seedCustomer] of SEED_ORDER_CUSTOMERS.entries()) {
    /*
     * Já tem pedido? Não cria de novo.
     *
     * `make seed` roda mais de uma vez no mesmo banco (é o que a seed de catálogo já assume), e sem esta
     * checagem cada execução acrescentaria seis pedidos — a tela de pedidos viraria uma pilha de
     * duplicatas e o teste de layout perderia o sentido.
     */
    const existingCustomer = await customerRepository.findByPhone(seedCustomer.phone)
    if (existingCustomer) {
      const lastOrder = await orderRepository.findLastByCustomer(existingCustomer.id)
      if (lastOrder) {
        skipped++
        continue
      }
    }

    /*
     * Produtos diferentes por cliente, girando o catálogo pelo índice.
     *
     * Determinístico de propósito: com sorteio, dois `make seed` produziriam pedidos diferentes e
     * "conferir se a tela ainda está certa" deixaria de ser comparação.
     */
    const items = Array.from({ length: seedCustomer.itemCount }, (_, itemIndex) => {
      const product = catalog.items[(index * 7 + itemIndex * 3) % catalog.items.length]!
      return { productId: product.id, quantity: (itemIndex % 3) + 1 }
    })

    await createWebOrderUseCase.execute({
      idempotencyKey: generateId(),
      customer: { name: seedCustomer.name, phone: seedCustomer.phone },
      items,
      deliveryType: seedCustomer.deliveryType,
      ...(seedCustomer.address ? { address: seedCustomer.address } : {}),
      paymentMethod: seedCustomer.paymentMethod,
      receiptPreference: 'whatsapp',
    })

    created++
    log.info('order_seeded', { purpose: seedCustomer.purpose })
  }

  log.info('orders_seeded', { created, skipped, total: SEED_ORDER_CUSTOMERS.length })
}
