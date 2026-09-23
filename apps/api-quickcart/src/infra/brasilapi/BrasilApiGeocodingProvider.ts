/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * CEP → coordenada pela BrasilAPI: sem chave, sem custo, e cobre CEPs que o Nominatim não indexa
 * (medido à mão para Franca-SP: 14412-314, 14400-000 e 14400-490 devolvem [] no Nominatim, mas a
 * BrasilAPI resolve todos três). A coordenada aqui é o centroide da cidade, não o endereço exato —
 * por isso este provider entra como primeira tentativa da cadeia, e o Nominatim continua como
 * fallback para quando ele tem o logradouro real.
 */

import {
  GEOCODE_OUTCOME_KIND,
  type GeocodeOutcome,
  type GeocodingProviderInterface,
} from '@/modules/shared/address/GeocodingProvider.interface'
import { GEOCODE_PRECISION } from '@/modules/shared/address/Address.schema'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import { maskCep } from '@/shared/maskCep'
import { BRASIL_API_CEP_URL, BRASIL_API_PROVIDER_NAME, BRASIL_API_REQUEST_TIMEOUT_MS } from '@/infra/brasilapi/brasilApi.constant'

const brasilApiLog = logger.child('BrasilApiGeocodingProvider')

const NOT_FOUND: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.NOT_FOUND }
const TRANSIENT_ERROR: GeocodeOutcome = { kind: GEOCODE_OUTCOME_KIND.TRANSIENT_ERROR }

type BrasilApiCoordinates = {
  readonly longitude?: string
  readonly latitude?: string
}

type BrasilApiCepResponse = {
  readonly location?: {
    readonly coordinates?: BrasilApiCoordinates
  }
}

export class BrasilApiGeocodingProvider implements GeocodingProviderInterface {
  async geocodeByCep(cep: string): Promise<GeocodeOutcome> {
    const digitsOnly = cep.replace(/\D/g, '')
    if (digitsOnly.length !== 8) return NOT_FOUND

    try {
      const response = await fetch(`${BRASIL_API_CEP_URL}/${digitsOnly}`, {
        signal: AbortSignal.timeout(BRASIL_API_REQUEST_TIMEOUT_MS),
      })

      if (response.status === 404) return NOT_FOUND
      if (!response.ok) {
        brasilApiLog.warn('geocode_http_error', { cep: maskCep(digitsOnly), status: response.status })
        const isTransient = response.status === 429 || response.status >= 500
        return isTransient ? TRANSIENT_ERROR : NOT_FOUND
      }

      const body = (await response.json()) as BrasilApiCepResponse
      const coordinates = body.location?.coordinates
      if (!coordinates?.latitude || !coordinates.longitude) return NOT_FOUND

      const latitude = Number(coordinates.latitude)
      const longitude = Number(coordinates.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NOT_FOUND

      return {
        kind: GEOCODE_OUTCOME_KIND.FOUND,
        /** Centroide da cidade, não do logradouro: CITY é a precisão que não mente sobre o dado. */
        coordinate: { latitude, longitude, precision: GEOCODE_PRECISION.CITY, provider: BRASIL_API_PROVIDER_NAME },
      }
    } catch (error: unknown) {
      brasilApiLog.warn('geocode_failed', { cep: maskCep(digitsOnly), error: serializeError(error) })
      return TRANSIENT_ERROR
    }
  }
}
