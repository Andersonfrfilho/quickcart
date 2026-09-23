/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import type { NotificationModule } from '@adatechnology/notification-module'

import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'

import { createSdkOrderStatusNotifier, type FreeFormWindowDelivery } from './SdkOrderStatusNotifier'

const CUSTOMER_ID = 'customer-1'
const CUSTOMER_PHONE = '5516993056772'

type SentNotification = {
  readonly channels?: readonly string[]
}

function buildHarness(params: { readonly hoursSinceLastInbound: number | undefined }) {
  const sentNotifications: SentNotification[] = []
  const sentTexts: Array<{ to: string; body: string }> = []

  const module = {
    useCases: {
      sendNotification: {
        execute: async (sendParams: SentNotification) => {
          sentNotifications.push(sendParams)
          return { notificationId: 'n1', deduplicated: false, deliveries: [] }
        },
      },
    },
  } as unknown as NotificationModule

  const freeFormWindow: FreeFormWindowDelivery = {
    resolveWhatsAppNumber: async () => CUSTOMER_PHONE,
    hoursSinceLastInbound: async () => params.hoursSinceLastInbound,
    sendText: async (to, body) => {
      sentTexts.push({ to, body })
    },
  }

  const notifier = createSdkOrderStatusNotifier({ module, companyId: 'company-1', freeFormWindow })

  return { notifier, sentNotifications, sentTexts }
}

async function notifyOutForDelivery(notifier: ReturnType<typeof buildHarness>['notifier']): Promise<void> {
  await notifier.notifyStatusChanged({
    orderId: 'order-1',
    customerId: CUSTOMER_ID,
    shortCode: 'QC-1008',
    status: ORDER_STATUS.OUT_FOR_DELIVERY,
  })
}

describe('createSdkOrderStatusNotifier', () => {
  it('dentro da janela manda texto livre e deixa o módulo só com o histórico', async () => {
    const harness = buildHarness({ hoursSinceLastInbound: 2 })

    await notifyOutForDelivery(harness.notifier)

    expect(harness.sentTexts).toHaveLength(1)
    expect(harness.sentTexts[0]?.to).toBe(CUSTOMER_PHONE)
    expect(harness.sentTexts[0]?.body).toContain('QC-1008')
    expect(harness.sentNotifications[0]?.channels).toEqual(['inbox'])
  })

  it('fora da janela não manda texto livre e deixa o fan-out por template', async () => {
    const harness = buildHarness({ hoursSinceLastInbound: 30 })

    await notifyOutForDelivery(harness.notifier)

    expect(harness.sentTexts).toHaveLength(0)
    expect(harness.sentNotifications[0]?.channels).toBeUndefined()
  })

  /** Conversa que nunca teve inbound: não saber a janela empurra para o template, nunca o contrário. */
  it('janela desconhecida cai no template', async () => {
    const harness = buildHarness({ hoursSinceLastInbound: undefined })

    await notifyOutForDelivery(harness.notifier)

    expect(harness.sentTexts).toHaveLength(0)
    expect(harness.sentNotifications[0]?.channels).toBeUndefined()
  })
})
