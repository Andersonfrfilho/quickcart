/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `z.unknown()` saiu do campo de endereço (T1.3) — este é o teste que prova que ele não voltou
 * disfarçado: entrega sem endereço estruturado e retirada com endereço precisam falhar aqui, antes
 * de qualquer coisa chegar ao banco.
 */

import { describe, expect, it } from 'bun:test'
import { createWebOrderBodySchema } from '@/modules/order/infra/http/schemas/CreateWebOrder.schema'

const VALID_ADDRESS = {
  cep: '01415-000',
  street: 'Rua das Acácias',
  number: '412',
  neighborhood: 'Jardim Paulista',
  city: 'São Paulo',
  state: 'SP',
}

function buildBody(overrides: Record<string, unknown> = {}) {
  return {
    customer: { name: 'Maria', phone: '5511988887777' },
    items: [{ productId: '11111111-1111-1111-1111-111111111111', quantity: 1 }],
    deliveryType: 'delivery',
    address: VALID_ADDRESS,
    paymentMethod: 'pix',
    receiptPreference: 'whatsapp',
    ...overrides,
  }
}

describe('createWebOrderBodySchema', () => {
  it('aceita entrega com endereço estruturado', () => {
    expect(createWebOrderBodySchema.safeParse(buildBody()).success).toBe(true)
  })

  it('aceita retirada sem endereço', () => {
    const result = createWebOrderBodySchema.safeParse(buildBody({ deliveryType: 'pickup', address: undefined }))
    expect(result.success).toBe(true)
  })

  it('recusa entrega sem endereço', () => {
    const result = createWebOrderBodySchema.safeParse(buildBody({ address: undefined }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'address')).toBe(true)
    }
  })

  it('recusa retirada com endereço', () => {
    // Endereço num pedido de retirada seria dado morto que ninguém lê — ou peor, um operador
    // presumindo que é para entregar lá.
    const result = createWebOrderBodySchema.safeParse(buildBody({ deliveryType: 'pickup' }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'address')).toBe(true)
    }
  })

  it('recusa endereço estruturalmente inválido, com todos os erros de uma vez', () => {
    const result = createWebOrderBodySchema.safeParse(
      buildBody({ address: { ...VALID_ADDRESS, cep: '123', state: 'São Paulo' } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('address.cep')
      expect(paths).toContain('address.state')
    }
  })

  it('recusa coordenada enviada pelo cliente — ela só nasce da geocodificação', () => {
    const result = createWebOrderBodySchema.safeParse(
      buildBody({ address: { ...VALID_ADDRESS, latitude: -23.5, longitude: -46.6 } }),
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.address).not.toHaveProperty('latitude')
      expect(result.data.address).not.toHaveProperty('longitude')
    }
  })
})
