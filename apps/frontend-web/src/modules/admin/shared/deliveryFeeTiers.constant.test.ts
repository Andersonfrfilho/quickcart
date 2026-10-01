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
import { parseDeliveryFeeTiersErrorMessage, resolveOutOfRangeWarning } from './deliveryFeeTiers.constant'

describe('parseDeliveryFeeTiersErrorMessage', () => {
  it('separa a mensagem juntada da api por linha', () => {
    const message = '0.maxDistanceKm: maxDistanceKm deve ser >= 0.1; 1.feeInCents: feeInCents deve ser inteiro'

    const rows = parseDeliveryFeeTiersErrorMessage(message)

    expect(rows.get(0)).toEqual(['maxDistanceKm deve ser >= 0.1'])
    expect(rows.get(1)).toEqual(['feeInCents deve ser inteiro'])
  })

  it('junta duas mensagens da mesma linha', () => {
    const message = '0.maxDistanceKm: erro A; 0.feeInCents: erro B'

    const rows = parseDeliveryFeeTiersErrorMessage(message)

    expect(rows.get(0)).toEqual(['erro A', 'erro B'])
  })

  it('erro sem índice numérico (ex.: tamanho da lista) cai na chave -1', () => {
    const message = 'A lista pode ter no máximo 10 faixas'

    const rows = parseDeliveryFeeTiersErrorMessage(message)

    expect(rows.get(-1)).toEqual(['A lista pode ter no máximo 10 faixas'])
  })
})

describe('resolveOutOfRangeWarning', () => {
  it('sem faixas, avisa que só há retirada', () => {
    expect(resolveOutOfRangeWarning([])).toBe('Sem faixas, só retirada.')
  })

  it('com faixas, avisa a partir da maior distância', () => {
    const tiers = [{ maxDistanceKm: 3 }, { maxDistanceKm: 8 }]
    expect(resolveOutOfRangeWarning(tiers)).toBe('Fora de 8 km a loja não entrega.')
  })
})
