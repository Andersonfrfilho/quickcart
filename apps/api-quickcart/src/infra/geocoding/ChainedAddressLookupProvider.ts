/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mesma ideia de `ChainedGeocodingProvider`, adaptada ao contrato de `AddressLookupProviderInterface`:
 * ele não distingue "CEP não existe" de "provedor fora do ar" no tipo de retorno — as duas viram
 * `undefined`, e quem chama (`CheckoutHandler`) já trata `undefined` como "não achei, siga com outro
 * caminho". Não há como reportar "transitório" separadamente sem alargar essa interface, e isso está
 * fora do escopo desta mudança. O que a cadeia entrega na prática é o mesmo resultado que a spec
 * pede: uma falha de rede num provedor não é mais a palavra final — o próximo provedor da lista
 * ainda tenta antes de responder "não achei esse CEP".
 */

import type {
  AddressLookupProviderInterface,
  AddressLookupResult,
} from '@/modules/shared/address/AddressLookupProvider.interface'

export class ChainedAddressLookupProvider implements AddressLookupProviderInterface {
  private readonly providers: readonly AddressLookupProviderInterface[]

  constructor(providers: readonly AddressLookupProviderInterface[]) {
    this.providers = providers
  }

  async lookupByCep(cep: string): Promise<AddressLookupResult | undefined> {
    for (const provider of this.providers) {
      const result = await provider.lookupByCep(cep)
      if (result) return result
    }

    return undefined
  }
}
