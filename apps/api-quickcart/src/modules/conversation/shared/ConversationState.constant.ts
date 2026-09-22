/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Tabela completa de estados/handlers: spec §4. `cart_review` em diante (inclusive)
 * pertence à Fase 5 — o ConversationEngine da Fase 4 registra handlers só até
 * `resolving_items`/`browsing_categories`/`awaiting_quantity`; a sessão fica
 * "estacionada" nos demais estados até a Fase 5 registrar os handlers correspondentes.
 */

export const CONVERSATION_STATE = {
  GREETING: 'greeting',
  MAIN_MENU: 'main_menu',
  AWAITING_LIST: 'awaiting_list',
  BROWSING_CATEGORIES: 'browsing_categories',
  AWAITING_QUANTITY: 'awaiting_quantity',
  RESOLVING_ITEMS: 'resolving_items',
  CART_REVIEW: 'cart_review',
  EDITING_CART: 'editing_cart',
  AWAITING_DELIVERY_TYPE: 'awaiting_delivery_type',
  /** Pede o CEP ou a localização do WhatsApp. Texto livre sem CEP não serve para entrega (não dá para cotar). */
  AWAITING_ADDRESS: 'awaiting_address',
  /** CEP resolvido ou localização recebida — pede número (e complemento) para completar o endereço. */
  AWAITING_ADDRESS_NUMBER: 'awaiting_address_number',
  /** Cotação fora do raio ou indisponível: o cliente escolhe entre retirar na loja e outro endereço. */
  AWAITING_OUT_OF_RANGE_DECISION: 'awaiting_out_of_range_decision',
  /**
   * Cotação só pela cidade (D3): antes de cobrar a maior faixa em silêncio, o cliente confirma o
   * endereço — mandar a localização, trocar o endereço ou retirar na loja. O mesmo estado aceita a
   * mensagem de localização enquanto ela é esperada.
   */
  AWAITING_APPROXIMATE_ADDRESS_DECISION: 'awaiting_approximate_address_decision',
  AWAITING_PAYMENT: 'awaiting_payment',
  /** Só existe quando o pagamento é em dinheiro (roteiro §9): pergunta sim/não sobre troco. */
  AWAITING_CASH_CHANGE: 'awaiting_cash_change',
  /** Só depois de "Preciso de troco" — pede o valor com que o cliente vai pagar. */
  AWAITING_CASH_CHANGE_AMOUNT: 'awaiting_cash_change_amount',
  AWAITING_RECEIPT_PREFERENCE: 'awaiting_receipt_preference',
  AWAITING_EMAIL: 'awaiting_email',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
} as const

export type ConversationState = (typeof CONVERSATION_STATE)[keyof typeof CONVERSATION_STATE]

export const SESSION_EXPIRY_MS = 6 * 60 * 60 * 1000
