/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O exception filter do router (`src/infra/http/router.ts`) responde qualquer `AppError` lendo só
 * `statusCode` e `code` — genérico para todo o app. O que este teste prova é que as TRÊS classes de
 * T1.5 carregam exatamente o par (status, código) que a spec §3.5 promete, e que continuam
 * reconhecíveis como `AppError`/`OrderError` (o filtro decide pelo `instanceof`).
 */

import { describe, expect, it } from 'bun:test'
import { AppError } from '@/shared/errors/AppError.error'
import {
  DeliveryFeeChangedError,
  DeliveryOutOfRangeError,
  DeliveryUnavailableError,
  OrderError,
} from '@/shared/errors/OrderErrors'
import { DELIVERY_FEE_CHANGED, DELIVERY_OUT_OF_RANGE, DELIVERY_UNAVAILABLE } from '@/shared/errors/codes'

describe('Erros de taxa de entrega (T1.5)', () => {
  it('DeliveryOutOfRangeError: 422 e DELIVERY_OUT_OF_RANGE', () => {
    const error = new DeliveryOutOfRangeError({ distanceKm: 12, maxDistanceKm: 8 })

    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(OrderError)
    expect(error.statusCode).toBe(422)
    expect(error.code).toBe(DELIVERY_OUT_OF_RANGE)
    expect(error.details).toEqual({ distanceKm: 12, maxDistanceKm: 8 })
  })

  it('DeliveryFeeChangedError: 409 e DELIVERY_FEE_CHANGED', () => {
    const error = new DeliveryFeeChangedError({ previousFeeInCents: 500, currentFeeInCents: 1000 })

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(409)
    expect(error.code).toBe(DELIVERY_FEE_CHANGED)
    expect(error.details).toEqual({ previousFeeInCents: 500, currentFeeInCents: 1000 })
  })

  it('DeliveryUnavailableError: 422 e DELIVERY_UNAVAILABLE', () => {
    const error = new DeliveryUnavailableError('no_store_cep')

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(422)
    expect(error.code).toBe(DELIVERY_UNAVAILABLE)
    expect(error.details).toEqual({ reason: 'no_store_cep' })
  })
})
