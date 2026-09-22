/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * NFC-e com taxa de entrega > 0 (T2.1): o pagamento enviado ao provedor fiscal tem que ser a soma dos
 * itens. A NFC-e não admite frete; se a taxa entrasse no pagamento, a nota seria rejeitada.
 * O provedor fiscal, o Redis e a env são substituídos — o que está sob teste é só a montagem da emissão.
 */

import { describe, expect, it, mock } from 'bun:test'

import type { ReceiptParams } from '@/modules/receipt/application/providers/ReceiptProvider.interface'

type EmittedInput = {
  readonly items: ReadonlyArray<{ readonly valorTotal: number }>
  readonly payments: ReadonlyArray<{ readonly amount: number }>
  readonly totalAmount: number
}

const emitted: EmittedInput[] = []
const realEnvironment = (await import('@/infra/config/environment')).environment

mock.module('@/infra/config/environment', () => ({
  environment: {
    ...realEnvironment,
    FISCAL_CNPJ: '00000000000000',
    FISCAL_RAZAO_SOCIAL: 'Loja Teste',
    FISCAL_UF: 'SP',
    FISCAL_MUNICIPIO: 'São Paulo',
    FISCAL_CODIGO_MUNICIPIO: '3550308',
    FISCAL_CEP: '01001000',
    FISCAL_LOGRADOURO: 'Rua Teste',
    FISCAL_NUMERO_ENDERECO: '1',
    FISCAL_BAIRRO: 'Centro',
    FISCAL_CERTIFICADO_BASE64: 'certificado',
    FISCAL_CERTIFICADO_SENHA: 'senha',
    FISCAL_CSC_ID: '1',
    FISCAL_CSC_TOKEN: 'token',
  },
}))
mock.module('@/infra/queue/connection', () => ({ queueConnection: { incr: async () => 1 } }))
mock.module('@adatechnology/fiscal-provider', () => ({
  PaymentMethod: { PIX: 'pix', CARD_CREDIT: 'card_credit', CASH: 'cash' },
  createFiscalProvider: () => ({
    async emit(input: EmittedInput) {
      emitted.push(input)
      return { success: true, cupomPdf: { base64: Buffer.from('nfce').toString('base64') }, chaveAcesso: 'chave-1' }
    },
  }),
}))

const { FiscalReceiptProvider } = await import('./FiscalReceiptProvider')

describe('FiscalReceiptProvider — taxa de entrega fora da NFC-e', () => {
  it('com taxa > 0, pagamento e total da nota são a soma dos itens', async () => {
    const params: ReceiptParams = {
      shortCode: 'QC-1',
      customerName: null,
      items: [
        { productName: 'Arroz 5kg', unitPriceInCents: 2490, quantity: 2, totalInCents: 4980 },
        { productName: 'Feijão 1kg', unitPriceInCents: 890, quantity: 1, totalInCents: 890 },
      ],
      totalInCents: 5870,
      deliveryFeeInCents: 800,
      deliveryTierMaxKm: null,
      deliveryType: 'delivery',
      paymentMethod: 'pix',
      address: null,
      createdAt: new Date(),
      storeName: 'QuickCart',
    }

    const result = await new FiscalReceiptProvider().generate(params)
    const input = emitted[0]!
    const itemsSum = input.items.reduce((sum, item) => sum + item.valorTotal, 0)

    expect(result.fiscalDocumentId).toBe('chave-1')
    expect(input.payments).toHaveLength(1)
    expect(input.payments[0]?.amount).toBeCloseTo(itemsSum, 2)
    expect(input.payments[0]?.amount).toBeCloseTo(58.7, 2)
    expect(input.totalAmount).toBeCloseTo(itemsSum, 2)
  })
})
