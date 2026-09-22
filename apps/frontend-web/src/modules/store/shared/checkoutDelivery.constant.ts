/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Espelha `shared/errors/codes.ts` do api-quickcart — os dois códigos que `CreateWebOrder` pode
 * devolver quando a recotação (spec §3.5) diverge do que a tela mostrou.
 */

import type { CheckoutDeliveryQuote, CheckoutQuote, DeliveryType } from '@/shared/api/api.types'

export const DELIVERY_FEE_CHANGED_CODE = 'DELIVERY_FEE_CHANGED'
export const DELIVERY_OUT_OF_RANGE_CODE = 'DELIVERY_OUT_OF_RANGE'

export const CHECKOUT_DELIVERY_QUOTE_TEXT = {
  MISSING_CEP: 'Informe o CEP para calcular a taxa',
  OUT_OF_RANGE: 'Esse endereço fica fora da nossa área de entrega. Você pode retirar na loja ou tentar outro endereço.',
  UNAVAILABLE: 'Não foi possível calcular a taxa de entrega para este endereço agora. Tente novamente ou retire na loja.',
  FEE_CHANGED: 'A taxa de entrega mudou desde a última cotação. Confira o novo valor antes de confirmar.',
} as const

/**
 * Sem CEP completo, pede o CEP; com CEP mas fora do raio ou sem coordenada, explica e sugere
 * retirada (spec §3.5). `null` quando a taxa pode ser mostrada normalmente.
 */
export function resolveDeliveryQuoteMessage(params: {
  readonly deliveryType: DeliveryType
  readonly cep: string
  readonly quote: CheckoutQuote | undefined
}): string | null {
  if (params.deliveryType !== 'delivery') return null
  if (params.cep.replace(/\D/g, '').length < 8) return CHECKOUT_DELIVERY_QUOTE_TEXT.MISSING_CEP
  if (!params.quote) return null

  const kind: CheckoutDeliveryQuote['kind'] = params.quote.deliveryQuote.kind
  if (kind === 'out_of_range') return CHECKOUT_DELIVERY_QUOTE_TEXT.OUT_OF_RANGE
  if (kind === 'unavailable') return CHECKOUT_DELIVERY_QUOTE_TEXT.UNAVAILABLE
  return null
}

/**
 * Traduz o `code` de `getApiErrorCode()` na mensagem certa quando `CreateWebOrder` recusa a
 * recotação (spec §3.5). `shouldRefetchQuote` avisa o chamador para recotar antes do próximo envio.
 */
export function resolveCreateOrderErrorMessage(params: {
  readonly code: string | undefined
  readonly fallbackMessage: string
}): { readonly message: string; readonly shouldRefetchQuote: boolean } {
  if (params.code === DELIVERY_FEE_CHANGED_CODE) {
    return { message: CHECKOUT_DELIVERY_QUOTE_TEXT.FEE_CHANGED, shouldRefetchQuote: true }
  }
  if (params.code === DELIVERY_OUT_OF_RANGE_CODE) {
    return { message: CHECKOUT_DELIVERY_QUOTE_TEXT.OUT_OF_RANGE, shouldRefetchQuote: false }
  }
  return { message: params.fallbackMessage, shouldRefetchQuote: false }
}
