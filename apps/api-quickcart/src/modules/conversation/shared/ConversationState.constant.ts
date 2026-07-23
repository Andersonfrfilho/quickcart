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
  AWAITING_ADDRESS: 'awaiting_address',
  AWAITING_PAYMENT: 'awaiting_payment',
  AWAITING_RECEIPT_PREFERENCE: 'awaiting_receipt_preference',
  AWAITING_EMAIL: 'awaiting_email',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
} as const

export type ConversationState = (typeof CONVERSATION_STATE)[keyof typeof CONVERSATION_STATE]

export const SESSION_EXPIRY_MS = 6 * 60 * 60 * 1000
