/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Nenhum provedor cobre 100% dos CEPs sozinho: a BrasilAPI é mais completa mas dá centroide de
 * cidade, o Nominatim às vezes chega a rua/bairro mas não indexa alguns CEPs. A cadeia tenta em
 * ordem e para no primeiro FOUND. NOT_FOUND de um não é veredito final — só é NOT_FOUND quando
 * TODOS disserem que não acharam. Uma falha transitória no meio do caminho não pode virar NOT_FOUND
 * (poluiria o cache negativo de 24h com um CEP que talvez exista), então só volta NOT_FOUND quando
 * nenhum provedor falhou transitoriamente.
 */

import {
  GEOCODE_OUTCOME_KIND,
  type GeocodeOutcome,
  type GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'

const NOT_FOUND: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }
const TRANSIENT_ERROR: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR }

export class ChainedGeocodingProvider implements GeocodingProviderInterface {
  private readonly providers: readonly GeocodingProviderInterface[]

  constructor(providers: readonly GeocodingProviderInterface[]) {
    this.providers = providers
  }

  async geocodeByCep(cep: string): Promise<GeocodeOutcome> {
    let sawTransientError = false

    for (const provider of this.providers) {
      const outcome = await provider.geocodeByCep(cep)
      if (outcome.kind === GEOCODE_OUTCOME_KIND.FOUND) return outcome
      if (outcome.kind === GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR) sawTransientError = true
    }

    return sawTransientError ? TRANSIENT_ERROR : NOT_FOUND
  }
}
