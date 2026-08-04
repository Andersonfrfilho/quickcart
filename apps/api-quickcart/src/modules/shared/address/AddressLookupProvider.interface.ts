/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Rua/bairro/cidade/UF a partir do CEP — não coordenada. A coordenada é a Fase 3
 * (geocodificação, cache por CEP, spec §4); esta interface só resolve os campos que o
 * checkout do WhatsApp precisa auto-preencher para não pedir o endereço inteiro por texto livre.
 */

export type AddressLookupResult = {
  readonly street: string
  readonly neighborhood: string
  readonly city: string
  readonly state: string
}

export interface AddressLookupProviderInterface {
  /** `undefined` quando o CEP não resolve — nunca lança; quem chama decide o fallback. */
  lookupByCep(cep: string): Promise<AddressLookupResult | undefined>
}
