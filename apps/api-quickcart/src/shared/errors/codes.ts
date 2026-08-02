/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

// Códigos de erro centralizados, namespaced por domínio para facilitar filtro em logs/Sentry.

// ── Genéricos ─────────────────────────────────────────────────────────
export const UNAUTHORIZED = 'UNAUTHORIZED'
export const FORBIDDEN = 'FORBIDDEN'
export const NOT_FOUND = 'NOT_FOUND'
export const CONFLICT = 'CONFLICT'
export const VALIDATION_ERROR = 'VALIDATION_ERROR'
export const TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS'
export const INTERNAL_ERROR = 'INTERNAL_ERROR'
export const REQUEST_TIMEOUT = 'REQUEST_TIMEOUT'
export const INVALID_JSON_BODY = 'INVALID_JSON_BODY'

// ── Catalog (categorias/produtos) ────────────────────────────────────
export const CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND'
export const CATEGORY_NAME_DUPLICATE = 'CATEGORY_NAME_DUPLICATE'
export const PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND'
export const PRODUCT_BARCODE_DUPLICATE = 'PRODUCT_BARCODE_DUPLICATE'
export const PRODUCT_INSUFFICIENT_STOCK = 'PRODUCT_INSUFFICIENT_STOCK'
export const PRODUCT_SEARCH_QUERY_TOO_SHORT = 'PRODUCT_SEARCH_QUERY_TOO_SHORT'

// ── Cart (carrinho) ───────────────────────────────────────────────────
export const CART_ITEM_NOT_FOUND = 'CART_ITEM_NOT_FOUND'
export const CART_ITEM_INVALID_QUANTITY = 'CART_ITEM_INVALID_QUANTITY'
export const CART_PRODUCT_UNAVAILABLE = 'CART_PRODUCT_UNAVAILABLE'

// ── Orders (pedidos) ──────────────────────────────────────────────────
export const ORDER_NOT_FOUND = 'ORDER_NOT_FOUND'
export const ORDER_INSUFFICIENT_STOCK = 'ORDER_INSUFFICIENT_STOCK'
export const ORDER_IDEMPOTENCY_CONFLICT = 'ORDER_IDEMPOTENCY_CONFLICT'
export const ORDER_PHONE_MISMATCH = 'ORDER_PHONE_MISMATCH'
export const ORDER_CART_EMPTY = 'ORDER_CART_EMPTY'
export const ORDER_NO_PREVIOUS_ORDER = 'ORDER_NO_PREVIOUS_ORDER'
export const ORDER_INVALID_STATUS_TRANSITION = 'ORDER_INVALID_STATUS_TRANSITION'
export const IDEMPOTENCY_KEY_MISSING = 'IDEMPOTENCY_KEY_MISSING'

// ── Conversation (motor de conversa/WhatsApp) ────────────────────────
export const CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND'
// Exclusão parcial: objeto ficou no storage, então a conversa foi preservada para repetir.
export const CONVERSATION_DELETE_INCOMPLETE = 'CONVERSATION_DELETE_INCOMPLETE'
export const CONVERSATION_INVALID_STATE = 'CONVERSATION_INVALID_STATE'

// ── WhatsApp (integração Meta Cloud API) ─────────────────────────────
export const WHATSAPP_CONFIG_MISSING = 'WHATSAPP_CONFIG_MISSING'
export const WHATSAPP_INVALID_SIGNATURE = 'WHATSAPP_INVALID_SIGNATURE'
export const WHATSAPP_SEND_ERROR = 'WHATSAPP_SEND_ERROR'
export const WHATSAPP_NETWORK_ERROR = 'WHATSAPP_NETWORK_ERROR'

// ── Admin/auth interno ────────────────────────────────────────────────
export const ADMIN_TOKEN_INVALID = 'ADMIN_TOKEN_INVALID'
export const INTERNAL_TOKEN_INVALID = 'INTERNAL_TOKEN_INVALID'
