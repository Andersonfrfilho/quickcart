/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Erros do domínio de carrinho (usados a partir da Fase 5).
 */

import { DomainError } from '@/shared/errors/DomainError'
import { CART_ITEM_NOT_FOUND, CART_ITEM_INVALID_QUANTITY, CART_PRODUCT_UNAVAILABLE } from '@/shared/errors/codes'

const CART_DOMAIN = 'cart'

export class CartError extends DomainError {
  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message, statusCode, code, CART_DOMAIN, details)
    this.name = 'CartError'
  }
}

export class CartItemNotFoundError extends CartError {
  constructor(cartItemId: string) {
    super(`Item de carrinho "${cartItemId}" não encontrado.`, 404, CART_ITEM_NOT_FOUND, { cartItemId })
  }
}

export class CartItemInvalidQuantityError extends CartError {
  constructor(quantity: number) {
    super('A quantidade do item deve ser maior que zero.', 400, CART_ITEM_INVALID_QUANTITY, { quantity })
  }
}

export class CartProductUnavailableError extends CartError {
  constructor(productId: string) {
    super(`Produto "${productId}" não está disponível para venda.`, 409, CART_PRODUCT_UNAVAILABLE, { productId })
  }
}
