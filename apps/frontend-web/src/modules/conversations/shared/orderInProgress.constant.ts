/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const CONVERSATION_CHECKOUT_CONTEXT_QUERY_KEY = 'conversation-checkout-context'

// O carrinho muda enquanto o atendente olha a conversa; sem refetch o card mostraria o pedido de minutos atrás.
export const ORDER_IN_PROGRESS_REFETCH_INTERVAL_MS = 15_000

export const ORDER_IN_PROGRESS_TEXT = {
  TITLE: '🛒 Pedido em andamento',
  SUBTOTAL: 'Subtotal',
  DELIVERY_FEE: 'Taxa de entrega',
  FREE_DELIVERY: 'grátis',
  AMOUNT_DUE: 'Total',
  NOT_CHOSEN: 'a definir',
  DELIVERY_TYPE: 'Recebimento',
  PAYMENT_METHOD: 'Pagamento',
  CASH_CHANGE_FOR: 'Troco para',
  NO_CASH_CHANGE: 'sem troco',
} as const

/**
 * Chaves do contexto da sessão que o card mostra, já formatadas. Escondidas da coluna lateral para o
 * mesmo dado não aparecer duas vezes — e, no caso do carrinho e do endereço, como JSON cru.
 */
export const ORDER_IN_PROGRESS_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'cartDraft',
  'unmatchedTerms',
  'pendingResolutions',
  'awaitingQuantityProduct',
  'editingCartItemId',
  'checkoutDeliveryType',
  'checkoutDeliveryFeeInCents',
  'checkoutAddress',
  'checkoutAddressDraft',
  'checkoutPaymentMethod',
  'checkoutCashChangeForInCents',
])
