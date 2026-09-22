/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * T5.1: o detalhe do pedido mostra "Faixa até N km · X km", lida do PEDIDO (snapshot da cotação,
 * spec §3.7), nunca da configuração de faixas vigente.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { OrderDetailView } from './OrderDetailView'
import type { OrderDetail } from '@/shared/api/api.types'

function buildOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'order-1',
    shortCode: 'QC-1001',
    customerName: 'Cliente Teste',
    customerPhone: '5511999990000',
    status: 'preparing',
    deliveryType: 'delivery',
    paymentMethod: 'pix',
    createdAt: new Date().toISOString(),
    totalInCents: 5000,
    deliveryFeeInCents: 500,
    amountDueInCents: 5500,
    deliveryFailureReason: null,
    requiresCardMachine: false,
    allowedNextStatuses: [],
    address: { street: 'Rua Teste', number: '10', neighborhood: 'Bairro', city: 'São Paulo', state: 'SP' },
    legacyAddressText: null,
    receiptPreference: 'whatsapp',
    notes: null,
    customerDecisionAskedAt: null,
    cashChangeForInCents: null,
    items: [],
    deliveryAttempts: [],
    deliveryDistanceKm: null,
    deliveryTierMaxKm: null,
    deliveryTierFeeInCents: null,
    deliveryLocationSource: null,
    ...overrides,
  }
}

function renderView(order: OrderDetail): string {
  return renderToStaticMarkup(
    <OrderDetailView
      order={order}
      items={order.items}
      visibleItems={order.items}
      pickedItemIds={[]}
      pickedCount={0}
      hidePickedItems={false}
      isUpdatingStatus={false}
      onSetUnavailable={() => {}}
      onNotifyUnavailable={() => {}}
      isNotifyingUnavailable={false}
      onOpenConversation={() => {}}
      onTogglePicked={() => {}}
      onClearPicked={() => {}}
      onPickAll={() => {}}
      onToggleHidePicked={() => {}}
      onUpdateStatus={() => {}}
      onBack={() => {}}
    />,
  )
}

describe('OrderDetailView — faixa de entrega do pedido (T5.1)', () => {
  it('mostra "Faixa até N km · X km" quando a cotação tem distância exata', () => {
    const html = renderView(
      buildOrder({ deliveryTierMaxKm: 8, deliveryDistanceKm: 6.4, deliveryLocationSource: 'cep' }),
    )

    expect(html).toContain('Faixa até 8 km')
    expect(html).toContain('6,4 km')
  })

  it('CEP aproximado: mostra a faixa sem distância, com aviso de aproximação', () => {
    const html = renderView(
      buildOrder({ deliveryTierMaxKm: 8, deliveryDistanceKm: null, deliveryLocationSource: 'cep_approximate' }),
    )

    expect(html).toContain('Faixa até 8 km')
    expect(html).toContain('aprox.')
  })

  it('pedido sem cotação (retirada ou pedido antigo): nada de faixa é mostrado', () => {
    const html = renderView(buildOrder({ deliveryTierMaxKm: null, deliveryDistanceKm: null }))

    expect(html).not.toContain('Faixa até')
  })
})
