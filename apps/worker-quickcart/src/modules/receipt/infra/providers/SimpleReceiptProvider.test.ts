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

import type { ReceiptParams } from '@/modules/receipt/application/providers/ReceiptProvider.interface'
import { buildTotalLines, SimpleReceiptProvider } from './SimpleReceiptProvider'

function buildParams(overrides: Partial<ReceiptParams> = {}): ReceiptParams {
  return {
    shortCode: 'QC-1',
    customerName: null,
    items: [{ productName: 'Arroz 5kg', unitPriceInCents: 2490, quantity: 2, totalInCents: 4980 }],
    totalInCents: 4980,
    deliveryFeeInCents: 800,
    deliveryTierMaxKm: null,
    deliveryType: 'delivery',
    paymentMethod: 'pix',
    address: null,
    createdAt: new Date('2026-09-21T12:00:00Z'),
    storeName: 'QuickCart',
    ...overrides,
  }
}

const brl = (cents: number): string => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

describe('SimpleReceiptProvider — taxa de entrega', () => {
  it('entrega: subtotal dos itens, linha da taxa e total cobrado (itens + taxa)', () => {
    expect(buildTotalLines(buildParams()).map((line) => line.text)).toEqual([
      `Subtotal: ${brl(4980)}`,
      `Taxa de entrega: ${brl(800)}`,
      `Total: ${brl(5780)}`,
    ])
  })

  it('entrega com taxa 0 mostra "grátis"', () => {
    expect(buildTotalLines(buildParams({ deliveryFeeInCents: 0 }))[1]?.text).toBe('Taxa de entrega: grátis')
  })

  it('entrega com faixa registrada mostra "Entrega (até N km)"', () => {
    expect(buildTotalLines(buildParams({ deliveryTierMaxKm: 8 }))[1]?.text).toBe(`Taxa de entrega (até 8 km): ${brl(800)}`)
  })

  it('retirada não mostra linha de taxa', () => {
    expect(buildTotalLines(buildParams({ deliveryType: 'pickup', deliveryFeeInCents: 0 })).map((line) => line.text)).toEqual([
      `Total: ${brl(4980)}`,
    ])
  })

  it('gera o PDF com a taxa', async () => {
    const result = await new SimpleReceiptProvider().generate(buildParams())

    expect(result.pdf.length).toBeGreaterThan(0)
    expect(result.fiscalDocumentId).toBeNull()
  })
})
