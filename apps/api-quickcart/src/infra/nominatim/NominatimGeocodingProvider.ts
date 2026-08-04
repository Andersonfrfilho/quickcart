/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * CEP → coordenada pelo Nominatim (OpenStreetMap): sem chave, sem custo, e o único dos três
 * provedores avaliados que realmente devolve coordenada por CEP (spec §4.1).
 *
 * A política de uso dele é o que molda esta classe: `User-Agent` identificando a aplicação é
 * obrigatório, 1 requisição por segundo é o teto, e uso em massa é proibido. O que torna isso viável
 * não é esta classe, é o cache por CEP em volta dela (`ResolveCepCoordinate`) — sem o cache, uma loja
 * movimentada violaria a política no primeiro dia e perderia o acesso, e a feature morreria em
 * silêncio.
 */

import type {
  GeocodeResult,
  GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_PRECISION, type GeocodePrecision } from '@/modules/shared/address/Address.schema'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const nominatimLog = logger.child('NominatimGeocodingProvider')

const PROVIDER_NAME = 'nominatim'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

/** Exigência da política de uso: precisa identificar a aplicação, não um `fetch` anônimo. */
const USER_AGENT = 'quickcart/1.0 (+https://github.com/Andersonfrfilho/quickcart)'

/** Teto da política: 1 req/s. Serializado no processo, porque quem chama não sabe do limite. */
const MIN_INTERVAL_BETWEEN_CALLS_MS = 1100

type NominatimAddress = {
  readonly road?: string
  readonly suburb?: string
  readonly city_district?: string
  readonly neighbourhood?: string
  readonly city?: string
  readonly town?: string
  readonly municipality?: string
}

type NominatimHit = {
  readonly lat?: string
  readonly lon?: string
  readonly address?: NominatimAddress
}

/**
 * A precisão sai das CHAVES do endereço, medido contra a API real — não do campo `type`, que devolve
 * `postcode` para todos, nem de `place_rank`, que devolve 21 para todos.
 *
 * | CEP medido | chaves | o que a coordenada é |
 * |---|---|---|
 * | `01310-100` | `suburb`, `city` | centro do bairro Bela Vista |
 * | `01415-000` | `city_district`, `city` | centro da Consolação |
 * | `37925-000` | só `municipality` | centro de Piumhi — o município inteiro |
 *
 * `street` não aparece nesta função de propósito: busca por CEP no Nominatim NUNCA devolve `road`
 * (medido nos três casos acima), então marcar precisão de rua seria alegar 100 m onde há 1 km. O
 * valor continua no enum porque um provedor futuro (rota real, ou CEP+número geocodificado) pode
 * alcançá-lo — mas não este caminho.
 */
function resolvePrecision(address: NominatimAddress | undefined): GeocodePrecision {
  if (!address) return GEOCODE_PRECISION.NONE
  if (address.suburb || address.city_district || address.neighbourhood) return GEOCODE_PRECISION.POSTAL_CODE
  if (address.city || address.town || address.municipality) return GEOCODE_PRECISION.CITY
  return GEOCODE_PRECISION.NONE
}

export class NominatimGeocodingProvider implements GeocodingProviderInterface {
  private lastCallAt = 0

  async geocodeByCep(cep: string): Promise<GeocodeResult | undefined> {
    const digitsOnly = cep.replace(/\D/g, '')
    if (digitsOnly.length !== 8) return undefined

    await this.waitForRateLimit()

    const formattedCep = `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`
    const url = `${NOMINATIM_SEARCH_URL}?postalcode=${formattedCep}&country=Brazil&format=jsonv2&addressdetails=1&limit=1`

    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!response.ok) {
        nominatimLog.warn('geocode_http_error', { cep: digitsOnly, status: response.status })
        return undefined
      }

      const hits = (await response.json()) as NominatimHit[]
      const hit = hits[0]
      if (!hit?.lat || !hit.lon) return undefined

      const latitude = Number(hit.lat)
      const longitude = Number(hit.lon)
      // Coordenada não numérica é resposta corrompida, não "achou no meio do Atlântico".
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined

      return { latitude, longitude, precision: resolvePrecision(hit.address), provider: PROVIDER_NAME }
    } catch (error: unknown) {
      nominatimLog.warn('geocode_failed', { cep: digitsOnly, error: serializeError(error) })
      return undefined
    }
  }

  /**
   * Espera o intervalo mínimo desde a última chamada DESTA instância.
   *
   * Guarda de processo, não distribuída: com o cache por CEP na frente, o volume real é de dezenas de
   * chamadas por semana, e uma trava distribuída (Redis) seria complexidade para um risco que o cache
   * já removeu. Vale registrar o limite: dois processos da api em paralelo podem, na teoria, passar de
   * 1 req/s — o que exigiria dois CEPs novos no mesmo segundo, em dois processos.
   */
  private async waitForRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastCallAt
    if (this.lastCallAt > 0 && elapsed < MIN_INTERVAL_BETWEEN_CALLS_MS) {
      await Bun.sleep(MIN_INTERVAL_BETWEEN_CALLS_MS - elapsed)
    }
    this.lastCallAt = Date.now()
  }
}
