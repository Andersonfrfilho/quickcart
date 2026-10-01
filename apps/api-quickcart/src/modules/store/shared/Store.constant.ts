/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const MY_ORDERS_DEFAULT_PER_PAGE = 20
export const MY_ORDERS_MAX_PER_PAGE = 50
/** Limite de linhas na cotação pública de checkout (T2.2) — cada uma lê um produto no banco. */
export const CHECKOUT_QUOTE_MAX_ITEMS = 100

/**
 * Teto por linha. Não é regra de estoque — quem decide isso é o pedido —, é sanidade de uma rota
 * pública: sem ele, uma quantidade absurda faz a multiplicação de preço perder precisão.
 */
export const CHECKOUT_QUOTE_MAX_QUANTITY_PER_ITEM = 999

/** Teto do corpo da cotação pública: 100 linhas de JSON cabem com folga em 64 KB. */
export const CHECKOUT_QUOTE_MAX_BODY_BYTES = 64 * 1024
export const CHECKOUT_QUOTE_RATE_LIMIT_SCOPE = 'checkout-quote'
export const CHECKOUT_QUOTE_RATE_LIMIT_PER_WINDOW = 60
export const CHECKOUT_QUOTE_RATE_LIMIT_WINDOW_SECONDS = 60
/** Cadastro público de cliente: mais duro que a cotação — ninguém se cadastra 10 vezes por minuto. */
export const STORE_REGISTER_RATE_LIMIT_SCOPE = 'store-register'
export const STORE_REGISTER_RATE_LIMIT_PER_WINDOW = 10
export const STORE_REGISTER_RATE_LIMIT_WINDOW_SECONDS = 60
