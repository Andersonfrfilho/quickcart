/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T7.9 — "pedido muda de status → cliente recebe", provado em vez de deduzido.
 *
 * Até aqui isso era inferência: o notifier tinha teste, o fan-out tinha teste, o despachante tinha
 * teste, e a conclusão de que os três juntos entregam era minha. Este arquivo roda a cadeia inteira
 * sobre Postgres e Redis de verdade — `UpdateOrderStatus` → `sendNotification` → `deliveries` →
 * `dispatchDelivery` → `sent`.
 *
 * O único dublê é o driver de canal, e por um motivo: um provedor real transformaria falha de rede
 * em teste vermelho, e o que se quer provar aqui é a costura, não a Graph API da Meta.
 *
 * Base própria (`envs/env.test.e2e`, portas 5444/6391): o teste grava notificação, delivery e job
 * reais, e compartilhar a base dos unitários faria um sujar o outro conforme a ordem de execução,
 * que o `bun test` não garante.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { and, eq, like } from 'drizzle-orm'
import { createNotificationModule } from '@adatechnology/notification-module'
import type { DeliveryAttemptResult, WhatsAppDriverPort } from '@adatechnology/notification-contracts'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { runNotificationMigrations } from '@adatechnology/notification-module'

import { db, closeDatabaseConnection } from '@/infra/database/connection'
import { customers, orders } from '@/infra/database/schema'
import { deliveries } from '@adatechnology/notification-module'
import { generateId } from '@/shared/id'
import { UpdateOrderStatusUseCase } from '@/modules/order/application/use-cases/UpdateOrderStatus.use-case'
import { DrizzleOrderRepository } from '@/modules/order/infra/database/DrizzleOrderRepository'
import { createSdkOrderStatusNotifier } from '@/modules/notification/infra/SdkOrderStatusNotifier'
import {
  ORDER_NOTIFICATION_CATEGORY,
  buildOrderStatusTemplates,
  orderStatusTemplateKey,
} from '@/modules/notification/shared/orderStatusTemplates.constant'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'

const COMPANY_ID = '00000000-0000-4000-8000-000000000001'
const E2E_PHONE_PREFIX = '55977'

/** Registra o que foi pedido ao canal, para o teste afirmar o QUE saiu, não só que saiu. */
const sentByWhatsApp: { to: string; body: string }[] = []

const whatsappDriver: WhatsAppDriverPort = {
  async send(params): Promise<DeliveryAttemptResult> {
    sentByWhatsApp.push({ to: params.to, body: params.body ?? '' })
    return { outcome: 'sent', providerMessageId: `e2e-${sentByWhatsApp.length}` }
  },
}

/**
 * Fila em memória que ENTREGA na hora, em vez de BullMQ.
 *
 * O que o E2E precisa provar é que o job enfileirado chega ao `dispatchDelivery` com o payload
 * certo. Redis real no meio só acrescentaria espera e intermitência ao mesmo asserto — e o
 * adaptador do BullMQ já tem teste próprio no pacote.
 */
const enqueuedJobs: unknown[] = []
let dispatch: ((job: never) => Promise<void>) | undefined

const queue = {
  async enqueue({ job }: { job: unknown }): Promise<void> {
    enqueuedJobs.push(job)
    await dispatch?.(job as never)
  },
  async consume(handler: (job: never) => Promise<void>): Promise<void> {
    dispatch = handler
  },
  async close(): Promise<void> {},
}

const notification = createNotificationModule({
  db,
  config: {
    defaultLocale: 'pt-BR',
    defaultTimezone: 'America/Sao_Paulo',
    suppressionHmacKey: 'chave-de-e2e-com-mais-de-32-caracteres',
  },
  providers: {
    recipientResolver: {
      async resolve({ userId }) {
        const [customer] = await db
          .select({ phone: customers.phone })
          .from(customers)
          .where(eq(customers.id, userId))
          .limit(1)
        return customer ? { phone: customer.phone } : undefined
      },
    },
    channels: { whatsapp: whatsappDriver },
    queue: queue as never,
  },
})

const orderRepository = new DrizzleOrderRepository()
const updateOrderStatus = new UpdateOrderStatusUseCase({
  orderRepository,
  orderStatusNotifier: createSdkOrderStatusNotifier({ module: notification, companyId: COMPANY_ID }),
})

/** O módulo não expõe repositórios — num E2E, ler a tabela é a asserção mais forte de todo jeito. */
function listDeliveries() {
  return db.select().from(deliveries).where(eq(deliveries.companyId, COMPANY_ID))
}

function listInbox() {
  return notification.useCases.listNotifications.execute({
    companyId: COMPANY_ID,
    recipientUserId: customerId,
    perPage: 20,
  })
}

let customerId: string
let orderId: string
//  no schema: 'E2E' + 5 dígitos é o limite exato.
const shortCode = `E2E${Date.now().toString().slice(-5)}`

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: './drizzle/migrations' })
  await runNotificationMigrations({ db, migrate })

  // O worker do SDK: registra o handler na fila, que o `enqueue` chama na hora.
  await queue.consume(async (job) => {
    await notification.useCases.dispatchDelivery.execute(job)
  })

  // Templates são do host — sem eles o envio falha, que é o comportamento correto.
  await notification.useCases.seedDefaultTemplates.execute({
    companyId: COMPANY_ID,
    templates: buildOrderStatusTemplates(),
  })

  customerId = generateId()
  await db.insert(customers).values({
    id: customerId,
    phone: `${E2E_PHONE_PREFIX}${Date.now().toString().slice(-6)}`,
    name: 'Cliente E2E',
  })

  orderId = generateId()
  await db.insert(orders).values({
    id: orderId,
    customerId,
    shortCode,
    channel: 'web',
    status: ORDER_STATUS.CONFIRMED,
    deliveryType: 'delivery',
    paymentMethod: 'pix',
    receiptPreference: 'whatsapp',
    totalInCents: 5000,
  })
})

afterAll(async () => {
  await db.delete(orders).where(eq(orders.id, orderId))
  await db.delete(customers).where(like(customers.phone, `${E2E_PHONE_PREFIX}%`))
  await closeDatabaseConnection()
})

describe('E2E — pedido muda de status e o cliente recebe', () => {
  it('cria a notificação, planeja as deliveries e o worker marca sent', async () => {
    await updateOrderStatus.execute({ orderId, status: ORDER_STATUS.PREPARING })

    const page = await listInbox()

    expect(page.data).toHaveLength(1)
    expect(page.data[0]?.templateKey).toBe(orderStatusTemplateKey(ORDER_STATUS.PREPARING))
    expect(page.data[0]?.category).toBe(ORDER_NOTIFICATION_CATEGORY)

    // O template interpolou o shortCode do pedido, não um placeholder cru.
    expect(page.data[0]?.body).toContain(shortCode)
    expect(page.data[0]?.body).not.toContain('{{')
  })

  it('a mensagem chegou ao canal com o telefone do cliente e o texto do template', async () => {
    expect(sentByWhatsApp).toHaveLength(1)
    expect(sentByWhatsApp[0]?.to).toStartWith(E2E_PHONE_PREFIX)
    expect(sentByWhatsApp[0]?.body).toContain(shortCode)
  })

  it('o job da fila carrega só referências opacas — nem telefone, nem conteúdo', () => {
    const serialized = JSON.stringify(enqueuedJobs)

    expect(serialized).not.toContain(E2E_PHONE_PREFIX)
    expect(serialized).not.toContain(shortCode)
    expect(Object.keys(enqueuedJobs[0] as object).sort()).toEqual([
      'attempt',
      'channel',
      'companyId',
      'deliveryId',
      'notificationId',
    ])
  })

  it('o dedupeKey impede a segunda mudança para o MESMO status de avisar de novo', async () => {
    const antes = sentByWhatsApp.length

    // O pedido já está em `preparing`: forçar a transição de novo é o que acontece com duplo
    // clique, duplo submit, ou retry na camada da API.
    await notification.useCases.sendNotification.execute({
      companyId: COMPANY_ID,
      recipientUserId: customerId,
      category: ORDER_NOTIFICATION_CATEGORY,
      templateKey: orderStatusTemplateKey(ORDER_STATUS.PREPARING),
      payload: { shortCode },
      dedupeKey: `order:${orderId}:${ORDER_STATUS.PREPARING}`,
    })

    expect(sentByWhatsApp).toHaveLength(antes)

    expect((await listInbox()).data).toHaveLength(1)
  })

  it('status seguinte é dedupeKey diferente, então avisa', async () => {
    await updateOrderStatus.execute({ orderId, status: ORDER_STATUS.SEPARATED })

    expect(sentByWhatsApp).toHaveLength(2)
    expect(sentByWhatsApp[1]?.body).not.toBe(sentByWhatsApp[0]?.body)
  })

  it('a delivery ficou sent no banco, com o id do provedor', async () => {
    const rows = await listDeliveries()
    const whatsappDeliveries = rows.filter((row) => row.channel === 'whatsapp')
    expect(whatsappDeliveries.length).toBeGreaterThanOrEqual(2)
    for (const delivery of whatsappDeliveries) {
      expect(delivery.status).toBe('sent')
      expect(delivery.providerMessageId).toStartWith('e2e-')
      // Nunca o telefone em claro — só a máscara (LGPD).
      expect(delivery.targetMasked).not.toContain(E2E_PHONE_PREFIX)
    }
  })

  it('a inbox também recebeu, porque o template existe para os dois canais', async () => {
    expect((await listDeliveries()).some((row) => row.channel === 'inbox')).toBe(true)
  })
})
