/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Unit test com fakes em memória — cobre idempotência por job.id e o caminho de pedido não
 * encontrado (deve retornar sem lançar, para não gerar retry infinito no BullMQ).
 */

import { describe, expect, test } from 'bun:test'
import type { OrderNotificationData } from '@/modules/notification/infra/repositories/OrderNotificationRepository'
import { ProcessNotificationJobUseCase } from './ProcessNotificationJob.use-case'

class FakeIdempotencyGuard {
  private readonly processed = new Set<string>()

  async wasProcessed(key: string): Promise<boolean> {
    return this.processed.has(key)
  }

  async markProcessed(key: string): Promise<void> {
    this.processed.add(key)
  }
}

class FakeOrderNotificationDataFinder {
  constructor(private readonly orderData: OrderNotificationData | undefined) {}

  async findOrderNotificationData(_orderId: string): Promise<OrderNotificationData | undefined> {
    return this.orderData
  }
}

class FakeNotificationSender {
  readonly calls: { to: string; body: string }[] = []

  async sendText(to: string, body: string): Promise<unknown> {
    this.calls.push({ to, body })
    return { waMessageId: 'wamid.1' }
  }
}

const ORDER_DATA: OrderNotificationData = { orderId: 'order-1', shortCode: 'QC-1234', customerPhone: '5511999999999' }

function buildUseCase(orderData?: OrderNotificationData | undefined) {
  const idempotencyGuard = new FakeIdempotencyGuard()
  const orderNotificationDataFinder = new FakeOrderNotificationDataFinder(orderData)
  const notificationSender = new FakeNotificationSender()

  const useCase = new ProcessNotificationJobUseCase({ idempotencyGuard, orderNotificationDataFinder, notificationSender })

  return { useCase, idempotencyGuard, notificationSender }
}

describe('ProcessNotificationJobUseCase', () => {
  test('envia a notificação de um job novo e marca como processado', async () => {
    const { useCase, idempotencyGuard, notificationSender } = buildUseCase(ORDER_DATA)

    await useCase.execute({ jobId: 'job-1', orderId: 'order-1', status: 'confirmed' })

    expect(notificationSender.calls).toEqual([{ to: '5511999999999', body: expect.any(String) }])
    expect(await idempotencyGuard.wasProcessed('notification:processed:job-1')).toBe(true)
  })

  test('não reenvia a mesma notificação em uma reentrega do BullMQ (mesmo job.id)', async () => {
    const { useCase, notificationSender } = buildUseCase(ORDER_DATA)

    await useCase.execute({ jobId: 'job-1', orderId: 'order-1', status: 'confirmed' })
    await useCase.execute({ jobId: 'job-1', orderId: 'order-1', status: 'confirmed' })

    expect(notificationSender.calls).toHaveLength(1)
  })

  test('pedido não encontrado: não lança (evita retry infinito) e não envia mensagem', async () => {
    const { useCase, notificationSender } = buildUseCase(undefined)

    await expect(useCase.execute({ jobId: 'job-3', orderId: 'order-missing', status: 'confirmed' })).resolves.toBeUndefined()
    expect(notificationSender.calls).toHaveLength(0)
  })
})
