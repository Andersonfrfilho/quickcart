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
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CONVERSATION_CHECKOUT_CONTEXT_QUERY_KEY } from '@/modules/conversations/shared/orderInProgress.constant'
import type { ConversationCheckoutContext } from '@/shared/api/api.types'
import { OrderInProgressCard } from './OrderInProgressCard'

const PHONE = '5511999990000'

function renderWith(checkout: ConversationCheckoutContext | null): string {
  const queryClient = new QueryClient()
  queryClient.setQueryData([CONVERSATION_CHECKOUT_CONTEXT_QUERY_KEY, PHONE], checkout)
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <OrderInProgressCard whatsappNumber={PHONE} />
    </QueryClientProvider>,
  )
}

describe('OrderInProgressCard', () => {
  it('não renderiza nada sem pedido em andamento', () => {
    expect(renderWith(null)).toBe('')
  })

  it('mostra itens, taxa e o total que veio da API, sem somar', () => {
    const html = renderWith({
      items: [{ name: 'Arroz 5kg', quantity: 2, lineTotalInCents: 4980 }],
      subtotalInCents: 4980,
      deliveryType: 'delivery',
      deliveryFeeInCents: 800,
      // Propositalmente diferente de subtotal + taxa: o card tem de exibir o valor do backend.
      amountDueInCents: 12345,
      address: 'Praça da Sé, 10 — Sé, São Paulo/SP',
      paymentMethod: 'cash',
      cashChangeForInCents: 10000,
    })

    expect(html).toContain('2x Arroz 5kg')
    expect(html).toContain('8,00')
    expect(html).toContain('123,45')
    expect(html).toContain('Praça da Sé, 10')
    expect(html).toContain('Troco para')
  })

  it('taxa zero aparece como grátis', () => {
    const html = renderWith({
      items: [],
      subtotalInCents: 0,
      deliveryType: 'pickup',
      deliveryFeeInCents: 0,
      amountDueInCents: 0,
      address: null,
      paymentMethod: 'pix',
      cashChangeForInCents: null,
    })
    expect(html).toContain('grátis')
  })
})
