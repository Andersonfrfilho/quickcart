/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * ViaCEP: sem chave, sem custo — o requisito "eficiente e grátis" da spec de distância/ETA cumprido
 * pelo lado do endereço (a coordenada é outro provedor, Fase 3). Mesma lógica do
 * `viaCepLookup.ts` do frontend, duplicada de propósito: são apps Bun/React separados, e o cliente
 * WhatsApp roda no servidor, onde `fetch` para o front não alcança.
 */

import type {
  AddressLookupProviderInterface,
  AddressLookupResult,
} from '@/modules/shared/address/AddressLookupProvider.interface'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const viaCepLog = logger.child('ViaCepAddressLookupProvider')

type ViaCepResponse = {
  readonly erro?: boolean
  readonly logradouro?: string
  readonly bairro?: string
  readonly localidade?: string
  readonly uf?: string
}

export class ViaCepAddressLookupProvider implements AddressLookupProviderInterface {
  async lookupByCep(cep: string): Promise<AddressLookupResult | undefined> {
    const digitsOnly = cep.replace(/\D/g, '')
    if (digitsOnly.length !== 8) return undefined

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digitsOnly}/json/`)
      if (!response.ok) return undefined

      const data = (await response.json()) as ViaCepResponse
      // CEP genérico ou inexistente: ViaCEP responde 200 com `{ erro: true }`, não um status HTTP de erro.
      if (data.erro || !data.logradouro) return undefined

      return {
        street: data.logradouro,
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      }
    } catch (error: unknown) {
      viaCepLog.warn('cep_lookup_failed', { cep: digitsOnly, error: serializeError(error) })
      return undefined
    }
  }
}
