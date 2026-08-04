/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `addressInputSchema` é a fronteira: é o que decide se um endereço malformado vira 400 antes de
 * chegar à geocodificação, ou se um cliente conseguiria injetar a própria coordenada.
 */

import { describe, expect, it } from 'bun:test'
import { addressInputSchema, addressSchema } from '@/modules/shared/address/Address.schema'

const VALID_ADDRESS = {
  cep: '01415-000',
  street: 'Rua das Acácias',
  number: '412',
  neighborhood: 'Jardim Paulista',
  city: 'São Paulo',
  state: 'SP',
}

describe('addressSchema', () => {
  it('aceita o endereço completo, com apartamento e referência', () => {
    const result = addressSchema.safeParse({
      ...VALID_ADDRESS,
      complement: 'apto 71, Bloco B',
      reference: 'portão azul ao lado da padaria',
    })
    expect(result.success).toBe(true)
  })

  it('aceita número não numérico — "s/n" e "123A" são endereços reais', () => {
    expect(addressSchema.safeParse({ ...VALID_ADDRESS, number: 's/n' }).success).toBe(true)
    expect(addressSchema.safeParse({ ...VALID_ADDRESS, number: '123A' }).success).toBe(true)
  })

  it('recusa CEP fora do formato', () => {
    expect(addressSchema.safeParse({ ...VALID_ADDRESS, cep: '123' }).success).toBe(false)
  })

  it('recusa UF com mais ou menos de duas letras', () => {
    expect(addressSchema.safeParse({ ...VALID_ADDRESS, state: 'São Paulo' }).success).toBe(false)
  })


})

describe('addressInputSchema', () => {
  it('descarta coordenada mandada pelo cliente em vez de gravá-la', () => {
    /*
     * A coordenada não é campo de endereço: ela mora em `geocoded_addresses`, indexada por CEP. Zod
     * descarta chave que o schema não declara, então um cliente que mande `latitude` no corpo não
     * consegue inventar a própria distância até a loja — o valor simplesmente não chega ao banco.
     */
    const result = addressInputSchema.safeParse({
      ...VALID_ADDRESS,
      latitude: -23.5649659,
      longitude: -46.6518144,
      geocodePrecision: 'street',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('latitude')
      expect(result.data).not.toHaveProperty('longitude')
      expect(result.data).not.toHaveProperty('geocodePrecision')
    }
  })

  it('aceita o endereço sem complemento nem referência, os dois opcionais', () => {
    expect(addressInputSchema.safeParse(VALID_ADDRESS).success).toBe(true)
  })
})
