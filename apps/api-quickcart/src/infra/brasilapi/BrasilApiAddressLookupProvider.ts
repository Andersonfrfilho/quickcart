/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * CEP → rua/bairro/cidade/UF pela BrasilAPI: staging não alcança o ViaCEP a partir do Railway
 * (`Unable to connect`), e a BrasilAPI responde do mesmo host, com os mesmos campos, na v2
 * (`/api/cep/v2/<cep>`) — a mesma rota já usada para coordenada. Entra primeiro na cadeia, com o
 * ViaCEP como fallback para quando a rede permitir.
 */

import type {
  AddressLookupProviderInterface,
  AddressLookupResult,
} from '@/modules/shared/address/AddressLookupProvider.interface'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import { maskCep } from '@/shared/maskCep'
import { BRASIL_API_CEP_URL, BRASIL_API_REQUEST_TIMEOUT_MS } from '@/infra/brasilapi/brasilApi.constant'

const brasilApiLog = logger.child('BrasilApiAddressLookupProvider')

type BrasilApiCepResponse = {
  readonly street?: string
  readonly neighborhood?: string
  readonly city?: string
  readonly state?: string
}

export class BrasilApiAddressLookupProvider implements AddressLookupProviderInterface {
  async lookupByCep(cep: string): Promise<AddressLookupResult | undefined> {
    const digitsOnly = cep.replace(/\D/g, '')
    if (digitsOnly.length !== 8) return undefined

    try {
      const response = await fetch(`${BRASIL_API_CEP_URL}/${digitsOnly}`, {
        signal: AbortSignal.timeout(BRASIL_API_REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        if (response.status !== 404) {
          brasilApiLog.warn('address_lookup_http_error', { cep: maskCep(digitsOnly), status: response.status })
        }
        return undefined
      }

      const data = (await response.json()) as BrasilApiCepResponse
      if (!data.street) return undefined

      return {
        street: data.street,
        neighborhood: data.neighborhood ?? '',
        city: data.city ?? '',
        state: data.state ?? '',
      }
    } catch (error: unknown) {
      brasilApiLog.warn('address_lookup_failed', { cep: maskCep(digitsOnly), error: serializeError(error) })
      return undefined
    }
  }
}
