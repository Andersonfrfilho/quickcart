/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Erros do domínio de carrinho/pedidos (usados a partir da Fase 5).
 */

import { DomainError } from '@/shared/errors/DomainError'
import {
  ORDER_NOT_FOUND,
  ORDER_INSUFFICIENT_STOCK,
  ORDER_IDEMPOTENCY_CONFLICT,
  ORDER_PHONE_MISMATCH,
  ORDER_CART_EMPTY,
  ORDER_NO_PREVIOUS_ORDER,
  ORDER_INVALID_STATUS_TRANSITION,
} from '@/shared/errors/codes'

const ORDER_DOMAIN = 'order'

export class OrderError extends DomainError {
  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message, statusCode, code, ORDER_DOMAIN, details)
    this.name = 'OrderError'
  }
}

export class OrderNotFoundError extends OrderError {
  constructor(shortCode: string) {
    super(`Pedido "${shortCode}" não encontrado.`, 404, ORDER_NOT_FOUND, { shortCode })
  }
}

export class OrderInsufficientStockError extends OrderError {
  constructor(public readonly items: ReadonlyArray<{ productId: string; requested: number; available: number }>) {
    super('Um ou mais itens do pedido ficaram sem estoque suficiente.', 409, ORDER_INSUFFICIENT_STOCK, { items })
  }
}

export class OrderIdempotencyConflictError extends OrderError {
  constructor(idempotencyKey: string) {
    super('Uma requisição com esta Idempotency-Key já está em processamento.', 409, ORDER_IDEMPOTENCY_CONFLICT, { idempotencyKey })
  }
}

export class OrderPhoneMismatchError extends OrderError {
  constructor() {
    super('O telefone informado não confere com o cadastrado no pedido.', 403, ORDER_PHONE_MISMATCH)
  }
}

export class OrderEmptyCartError extends OrderError {
  constructor(cartId: string) {
    super('O carrinho está vazio.', 400, ORDER_CART_EMPTY, { cartId })
  }
}

export class OrderNoPreviousOrderError extends OrderError {
  constructor(customerId: string) {
    super('Nenhum pedido anterior encontrado para repetir.', 404, ORDER_NO_PREVIOUS_ORDER, { customerId })
  }
}

/**
 * Transição que a esteira não permite.
 *
 * 409 e não 422: o corpo é válido — "completed" é um status que existe — e o que impede é o ESTADO atual do
 * recurso. Quem recebe precisa distinguir "você mandou lixo" de "isso não cabe agora", porque a segunda
 * costuma significar que outra pessoa já mexeu no pedido e a tela de quem clicou está velha.
 *
 * Carrega os próximos válidos no contexto: sem isso, a tela só sabe que falhou, e o operador fica adivinhando
 * qual botão era o certo.
 */
export class OrderInvalidStatusTransitionError extends OrderError {
  constructor(params: {
    readonly currentStatus: string
    readonly nextStatus: string
    readonly allowedNextStatuses: readonly string[]
  }) {
    super(
      `Pedido em "${params.currentStatus}" não pode ir para "${params.nextStatus}".`,
      409,
      ORDER_INVALID_STATUS_TRANSITION,
      params,
    )
  }
}
