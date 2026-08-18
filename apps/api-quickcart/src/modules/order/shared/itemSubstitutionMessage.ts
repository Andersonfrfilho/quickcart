/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A oferta do parecido, montada num lugar só (ADR 0003).
 *
 * Mesmo motivo de `customerDecisionMessage`: quem oferece e quem confirma a troca falam do mesmo produto
 * e do mesmo dinheiro — em dois lugares, uma das duas acabaria anunciando um preço que a outra não cobra.
 */

import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import {
  buildItemSubstitutionButtons,
  type OrderDecisionButton,
} from '@/modules/conversation/shared/orderDecisionButton'
import type { ProductSearchResult } from '@/modules/catalog/domain/ProductRepository.interface'
import type { OrderDetail, OrderItemRecord } from '@/modules/order/domain/OrderRepository.interface'

export type ItemSubstitutionMessage = {
  readonly body: string
  readonly buttons: readonly OrderDecisionButton[]
}

/** Como o produto aparece na conversa: a marca é o que distingue o parecido do que faltou. */
export function describeCandidate(candidate: ProductSearchResult): string {
  const brand = candidate.brand ? `${candidate.brand} ` : ''
  const unitSize = candidate.unitSize ? ` ${candidate.unitSize}` : ''
  return `${brand}${candidate.name}${unitSize}`
}

/**
 * A diferença no TOTAL da linha, não no preço unitário.
 *
 * Quem compra três leites não quer saber que cada um custa R$ 0,20 a mais — quer saber que a conta sobe
 * R$ 0,60. Preços iguais não geram texto: "(R$ 0,00 no total)" é ruído que faz duvidar do resto.
 */
function priceDifferenceText(params: {
  readonly originalTotalInCents: number
  readonly substituteTotalInCents: number
}): string {
  const difference = params.substituteTotalInCents - params.originalTotalInCents
  if (difference === 0) return ''

  return MESSAGES.ORDER_ITEM_SUBSTITUTE_PRICE_DIFFERENCE.replace('{sinal}', difference > 0 ? '+' : '−').replace(
    '{valor}',
    formatPriceInCents(Math.abs(difference)),
  )
}

export function buildItemSubstitutionMessage(params: {
  readonly detail: OrderDetail
  readonly item: OrderItemRecord
  readonly candidate: ProductSearchResult
}): ItemSubstitutionMessage {
  const substituteName = describeCandidate(params.candidate)
  const substituteTotalInCents = Math.round(params.candidate.priceInCents * params.item.quantity)

  const body = MESSAGES.ORDER_ITEM_SUBSTITUTE_OFFER.replace('{item}', params.item.productName)
    .replace('{codigo}', params.detail.order.shortCode)
    .replace('{substituto}', substituteName)
    .replace('{preco}', formatPriceInCents(params.candidate.priceInCents))
    .replace(
      '{diferenca}',
      priceDifferenceText({
        originalTotalInCents: params.item.totalInCents,
        substituteTotalInCents,
      }),
    )

  return {
    body,
    buttons: buildItemSubstitutionButtons({
      orderId: params.detail.order.id,
      orderItemId: params.item.id,
      substituteProductId: params.candidate.id,
    }),
  }
}
