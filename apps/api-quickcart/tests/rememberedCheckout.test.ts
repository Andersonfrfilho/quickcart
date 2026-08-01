/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Aqui o erro caro não é perder o atalho — é aplicar preferência que não vale mais.
 *
 * Recusar a memória custa quatro toques; aceitá-la errada custa uma entrega no endereço antigo ou um
 * pedido com forma de pagamento que a loja não aceita mais, e o cliente descobre depois de confirmar.
 * Por isso os testes negativos são a maioria: na dúvida, o checkout pergunta.
 */

import { describe, expect, it } from 'bun:test'
import {
  describeRememberedCheckout,
  toRememberedCheckout,
} from '@/modules/conversation/application/rememberedCheckout'
import type { OrderRecord } from '@/modules/order/domain/OrderRepository.interface'

function orderWith(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'o1',
    shortCode: 'QC-1000',
    customerId: 'c1',
    cartId: null,
    channel: 'whatsapp',
    status: 'completed',
    totalInCents: 5729,
    deliveryType: 'pickup',
    address: null,
    paymentMethod: 'pix',
    receiptPreference: 'whatsapp',
    fiscalDocumentId: null,
    notes: null,
    createdAt: new Date('2026-07-25T12:00:00Z'),
    updatedAt: new Date('2026-07-25T12:00:00Z'),
    ...overrides,
  }
}

describe('toRememberedCheckout', () => {
  it('reaproveita retirada com pix e recibo no WhatsApp', () => {
    const remembered = toRememberedCheckout({ lastOrder: orderWith() })

    expect(remembered).toEqual({ deliveryType: 'pickup', paymentMethod: 'pix', receiptPreference: 'whatsapp' })
  })

  it('reaproveita entrega quando o endereço está guardado', () => {
    const remembered = toRememberedCheckout({
      lastOrder: orderWith({ deliveryType: 'delivery', address: 'Rua das Flores, 123' }),
    })

    expect(remembered?.address).toBe('Rua das Flores, 123')
  })

  it('recusa entrega sem endereço guardado', () => {
    // Inventar endereço a partir de pedido antigo entrega compra no lugar errado.
    expect(toRememberedCheckout({ lastOrder: orderWith({ deliveryType: 'delivery', address: null }) })).toBeUndefined()
  })

  it('recusa forma de pagamento que o produto não oferece mais', () => {
    // Replayar um valor extinto criaria pedido que a loja não sabe atender.
    expect(toRememberedCheckout({ lastOrder: orderWith({ paymentMethod: 'boleto' }) })).toBeUndefined()
  })

  it('recusa tipo de entrega desconhecido', () => {
    expect(toRememberedCheckout({ lastOrder: orderWith({ deliveryType: 'drone' }) })).toBeUndefined()
  })

  it('recusa recibo por e-mail sem e-mail no cadastro', () => {
    // Prometer atalho e ainda perguntar o e-mail faz o atalho parecer quebrado.
    expect(toRememberedCheckout({ lastOrder: orderWith({ receiptPreference: 'email' }) })).toBeUndefined()
  })

  it('reaproveita recibo por e-mail quando o cadastro tem e-mail', () => {
    const remembered = toRememberedCheckout({
      lastOrder: orderWith({ receiptPreference: 'email' }),
      customerEmail: ' rita@exemplo.com ',
    })

    expect(remembered?.email).toBe('rita@exemplo.com')
  })

  it('recusa quando não há pedido anterior', () => {
    expect(toRememberedCheckout({ lastOrder: undefined })).toBeUndefined()
  })
})

describe('describeRememberedCheckout', () => {
  it('descreve com os mesmos rótulos dos botões', () => {
    const summary = describeRememberedCheckout({
      deliveryType: 'pickup',
      paymentMethod: 'pix',
      receiptPreference: 'whatsapp',
    })

    // "pickup" na tela obrigaria o cliente a traduzir para conferir, e conferir é a função da tela.
    expect(summary).toContain('🏪 Retirada')
    expect(summary).toContain('💳 Pix')
    expect(summary).not.toContain('pickup')
  })

  it('mostra o endereço logo abaixo da entrega', () => {
    const summary = describeRememberedCheckout({
      deliveryType: 'delivery',
      address: 'Rua das Flores, 123',
      paymentMethod: 'cash',
      receiptPreference: 'whatsapp',
    })
    const lines = summary.split('\n')

    expect(lines[0]).toContain('Entrega')
    expect(lines[1]).toContain('Rua das Flores, 123')
  })
})
