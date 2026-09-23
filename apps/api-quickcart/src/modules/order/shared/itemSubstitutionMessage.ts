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
  buildItemSubstitutionRows,
  type OrderDecisionButton,
  type OrderDecisionRow,
} from '@/modules/conversation/shared/orderDecisionButton'
import type { ProductSearchResult } from '@/modules/catalog/domain/ProductRepository.interface'
import type { OrderDetail, OrderItemRecord } from '@/modules/order/domain/OrderRepository.interface'

/**
 * Como a oferta sai: botões quando há um parecido só, lista quando há mais de um.
 *
 * União e não um tipo com os dois campos opcionais: quem envia escolhe o canal pelo `kind`, sem ter de
 * adivinhar qual dos dois está preenchido — e um envio com os dois vazios deixaria de compilar.
 */
export type ItemSubstitutionMessage =
  | {
      readonly kind: 'buttons'
      readonly body: string
      readonly buttons: readonly OrderDecisionButton[]
    }
  | {
      readonly kind: 'list'
      readonly body: string
      readonly listButtonText: string
      readonly sectionTitle: string
      readonly rows: readonly OrderDecisionRow[]
    }

/**
 * Como a lista de parecidos chega ao cliente. Irmã de `AskCustomerDecision`, para o canal de lista.
 */
export type AskCustomerChoice = (params: {
  readonly whatsappNumber: string
  readonly body: string
  readonly listButtonText: string
  readonly sectionTitle: string
  readonly rows: readonly OrderDecisionRow[]
}) => Promise<void>

/** Teto de 24 caracteres do título de linha da WhatsApp Business API. */
const LIST_ROW_TITLE_MAX_LENGTH = 24

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

function substituteTotalInCents(params: {
  readonly candidate: ProductSearchResult
  readonly quantity: number
}): number {
  return Math.round(params.candidate.priceInCents * params.quantity)
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}

function offerLineFor(params: {
  readonly item: OrderItemRecord
  readonly candidate: ProductSearchResult
  readonly position: number
}): string {
  return MESSAGES.ORDER_ITEM_SUBSTITUTE_OPTION_LINE.replace('{posicao}', String(params.position))
    .replace('{substituto}', describeCandidate(params.candidate))
    .replace('{preco}', formatPriceInCents(params.candidate.priceInCents))
    .replace(
      '{diferenca}',
      priceDifferenceText({
        originalTotalInCents: params.item.totalInCents,
        substituteTotalInCents: substituteTotalInCents({
          candidate: params.candidate,
          quantity: params.item.quantity,
        }),
      }),
    )
}

/**
 * A oferta do parecido — um candidato vira pergunta de sim/não, vários viram escolha.
 *
 * Vários porque o primeiro parecido da busca é o mais semelhante, não o que a pessoa quer: quem pediu
 * açúcar refinado e recebe só a oferta de uma marca desiste da troca em vez de pedir outra marca que a
 * loja tem na prateleira.
 */
export function buildItemSubstitutionMessage(params: {
  readonly detail: OrderDetail
  readonly item: OrderItemRecord
  readonly candidates: readonly ProductSearchResult[]
}): ItemSubstitutionMessage | undefined {
  const [first, ...rest] = params.candidates
  if (!first) return undefined

  if (rest.length === 0) {
    const body = MESSAGES.ORDER_ITEM_SUBSTITUTE_OFFER.replace('{item}', params.item.productName)
      .replace('{codigo}', params.detail.order.shortCode)
      .replace('{substituto}', describeCandidate(first))
      .replace('{preco}', formatPriceInCents(first.priceInCents))
      .replace(
        '{diferenca}',
        priceDifferenceText({
          originalTotalInCents: params.item.totalInCents,
          substituteTotalInCents: substituteTotalInCents({ candidate: first, quantity: params.item.quantity }),
        }),
      )

    return {
      kind: 'buttons',
      body,
      buttons: buildItemSubstitutionButtons({
        orderId: params.detail.order.id,
        orderItemId: params.item.id,
        substituteProductId: first.id,
      }),
    }
  }

  const options = params.candidates
    .map((candidate, index) => offerLineFor({ item: params.item, candidate, position: index + 1 }))
    .join('\n')

  const body = MESSAGES.ORDER_ITEM_SUBSTITUTE_OFFER_MULTI.replace('{item}', params.item.productName)
    .replace('{codigo}', params.detail.order.shortCode)
    .replace('{opcoes}', options)

  return {
    kind: 'list',
    body,
    listButtonText: MESSAGES.ORDER_ITEM_SUBSTITUTE_LIST_BUTTON,
    sectionTitle: MESSAGES.ORDER_ITEM_SUBSTITUTE_LIST_SECTION,
    rows: buildItemSubstitutionRows({
      orderId: params.detail.order.id,
      orderItemId: params.item.id,
      substitutes: params.candidates.map((candidate) => ({
        productId: candidate.id,
        title: truncate(describeCandidate(candidate), LIST_ROW_TITLE_MAX_LENGTH),
        description: formatPriceInCents(candidate.priceInCents),
      })),
    }),
  }
}
