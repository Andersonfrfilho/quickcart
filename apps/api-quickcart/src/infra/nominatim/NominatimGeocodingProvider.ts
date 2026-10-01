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

import {
  GEOCODE_OUTCOME_KIND,
  type GeocodeOutcome,
  type GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_PRECISION, type GeocodePrecision } from '@/modules/shared/address/Address.schema'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import { maskCep } from '@/shared/maskCep'

const nominatimLog = logger.child('NominatimGeocodingProvider')

const PROVIDER_NAME = 'nominatim'
/** Busca estruturada por rua (não por CEP): fonte separada da coordenada, mesmo endpoint. */
const PROVIDER_NAME_STREET = 'nominatim-street'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

/** Exigência da política de uso: precisa identificar a aplicação, não um `fetch` anônimo. */
const USER_AGENT = 'quickcart/1.0 (+https://github.com/Andersonfrfilho/quickcart)'

/** Teto da política: 1 req/s. Serializado no processo, porque quem chama não sabe do limite. */
export const MIN_INTERVAL_BETWEEN_CALLS_MS = 1100

/** Uma resposta lenta não pode segurar a cotação do cliente nem a fila de quem vem atrás. */
export const NOMINATIM_REQUEST_TIMEOUT_MS = 3000

/** Com 1 req/s, o 11º da fila esperaria mais de 10 s — melhor falhar rápido como transitório. */
export const MAX_PENDING_GEOCODE_CALLS = 10

const NOT_FOUND: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }
const TRANSIENT_ERROR: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR }

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

export type NominatimStreetAddressQuery = {
  readonly street: string
  readonly city: string
  readonly state: string
}

type NominatimGeocodingProviderDependencies = {
  /** Injetáveis para teste, sem esperar 1,1s de verdade por chamada; produção usa os reais. */
  readonly now?: () => number
  readonly sleep?: (ms: number) => Promise<void>
}

export class NominatimGeocodingProvider implements GeocodingProviderInterface {
  /** Instante reservado para a próxima chamada: reservar ANTES de dormir é o que impede duas saírem juntas. */
  private nextSlotAt = 0
  private pendingCalls = 0
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(dependencies: NominatimGeocodingProviderDependencies = {}) {
    this.now = dependencies.now ?? (() => Date.now())
    this.sleep = dependencies.sleep ?? ((ms: number) => Bun.sleep(ms))
  }

  async geocodeByCep(cep: string): Promise<GeocodeOutcome> {
    const digitsOnly = cep.replace(/\D/g, '')
    if (digitsOnly.length !== 8) return NOT_FOUND

    if (this.pendingCalls >= MAX_PENDING_GEOCODE_CALLS) {
      nominatimLog.warn('geocode_queue_full', { cep: maskCep(digitsOnly) })
      return TRANSIENT_ERROR
    }

    this.pendingCalls += 1
    try {
      await this.waitForRateLimit()
      return await this.fetchCoordinate(digitsOnly)
    } finally {
      this.pendingCalls -= 1
    }
  }

  /**
   * Rua/cidade/UF → coordenada, via busca ESTRUTURADA (não `postalcode=`): é o caminho medido à mão
   * que devolve `road` de verdade (spec: rua da loja e do cliente em Franca-SP resolvem com estrutura,
   * `q=` em texto livre falha). Passa pela mesma fila e pelo mesmo `waitForRateLimit` do CEP — dois
   * clientes por perto da loja não podem juntos furar o 1 req/s do provedor.
   */
  async geocodeByAddress(address: NominatimStreetAddressQuery): Promise<GeocodeOutcome> {
    if (!address.street || !address.city || !address.state) return NOT_FOUND

    if (this.pendingCalls >= MAX_PENDING_GEOCODE_CALLS) {
      nominatimLog.warn('geocode_queue_full', { reason: 'structured_search' })
      return TRANSIENT_ERROR
    }

    this.pendingCalls += 1
    try {
      await this.waitForRateLimit()
      return await this.fetchStructuredCoordinate(address)
    } finally {
      this.pendingCalls -= 1
    }
  }

  private async fetchStructuredCoordinate(address: NominatimStreetAddressQuery): Promise<GeocodeOutcome> {
    const query = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'br',
      street: address.street,
      city: address.city,
      state: address.state,
    })
    const url = `${NOMINATIM_SEARCH_URL}?${query.toString()}`

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(NOMINATIM_REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        nominatimLog.warn('geocode_structured_http_error', { status: response.status })
        const isTransient = response.status === 429 || response.status >= 500
        return isTransient ? TRANSIENT_ERROR : NOT_FOUND
      }

      const hits = (await response.json()) as NominatimHit[]
      const hit = hits[0]
      if (!hit?.lat || !hit.lon) return NOT_FOUND

      const latitude = Number(hit.lat)
      const longitude = Number(hit.lon)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NOT_FOUND

      // Consulta estruturada por rua: a precisão É a do logradouro, não a inferida das chaves de `address`.
      return {
        kind: GEOCODE_OUTCOME_KIND.FOUND,
        coordinate: { latitude, longitude, precision: GEOCODE_PRECISION.STREET, provider: PROVIDER_NAME_STREET },
      }
    } catch (error: unknown) {
      nominatimLog.warn('geocode_structured_failed', { error: serializeError(error) })
      return TRANSIENT_ERROR
    }
  }

  private async fetchCoordinate(digitsOnly: string): Promise<GeocodeOutcome> {
    const formattedCep = `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`
    const url = `${NOMINATIM_SEARCH_URL}?postalcode=${formattedCep}&country=Brazil&format=jsonv2&addressdetails=1&limit=1`

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(NOMINATIM_REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        nominatimLog.warn('geocode_http_error', { cep: maskCep(digitsOnly), status: response.status })
        // 4xx que não seja 429 é pergunta malformada: repetir não muda a resposta.
        const isTransient = response.status === 429 || response.status >= 500
        return isTransient ? TRANSIENT_ERROR : NOT_FOUND
      }

      const hits = (await response.json()) as NominatimHit[]
      const hit = hits[0]
      if (!hit?.lat || !hit.lon) return NOT_FOUND

      const latitude = Number(hit.lat)
      const longitude = Number(hit.lon)
      // Coordenada não numérica é resposta corrompida, não "achou no meio do Atlântico".
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NOT_FOUND

      return {
        kind: GEOCODE_OUTCOME_KIND.FOUND,
        coordinate: { latitude, longitude, precision: resolvePrecision(hit.address), provider: PROVIDER_NAME },
      }
    } catch (error: unknown) {
      nominatimLog.warn('geocode_failed', { cep: maskCep(digitsOnly), error: serializeError(error) })
      return TRANSIENT_ERROR
    }
  }

  /**
   * Reserva o próximo slot de forma síncrona e só então dorme até ele: chamadas concorrentes pegam
   * slots sucessivos, espaçados pelo intervalo mínimo, em vez de lerem o mesmo "última chamada".
   *
   * Guarda de processo, não distribuída: com o cache por CEP na frente, o volume real é de dezenas de
   * chamadas por semana, e uma trava distribuída (Redis) seria complexidade para um risco que o cache
   * já removeu. Dois processos da api em paralelo podem, na teoria, passar de 1 req/s.
   */
  private async waitForRateLimit(): Promise<void> {
    const now = this.now()
    const slotAt = Math.max(now, this.nextSlotAt)
    this.nextSlotAt = slotAt + MIN_INTERVAL_BETWEEN_CALLS_MS
    const waitMs = slotAt - now
    if (waitMs > 0) await this.sleep(waitMs)
  }
}
