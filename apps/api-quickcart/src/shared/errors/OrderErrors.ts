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
  ORDER_CUSTOMER_APPROVAL_REQUIRED,
  ORDER_ITEM_NOT_SUBSTITUTABLE,
  ORDER_RECEIPT_ENQUEUE_FAILED,
  DELIVERY_OUT_OF_RANGE,
  DELIVERY_FEE_CHANGED,
  DELIVERY_UNAVAILABLE,
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

/**
 * "Avisar e seguir" num pedido onde não sobrou nada para seguir.
 *
 * 409 e não 400: o corpo é válido, o que impede é o ESTADO do pedido — todos os itens caíram, e seguir
 * sem perguntar entregaria uma sacola vazia. Aqui a decisão é do cliente, não da loja.
 */
export class OrderCustomerApprovalRequiredError extends OrderError {
  constructor(orderId: string) {
    super(
      'Nenhum item restou no pedido: o cliente precisa decidir entre montar outra lista ou cancelar.',
      409,
      ORDER_CUSTOMER_APPROVAL_REQUIRED,
      { orderId },
    )
  }
}

/**
 * A troca pedida não cabe: o item não está em falta, não é deste pedido, ou já foi trocado.
 *
 * 409 e não 404: os três casos são "a resposta chegou tarde", não "não existe" — e a diferença importa
 * para quem lê o log tentando entender um toque duplo (ADR 0003).
 */
export class OrderItemNotSubstitutableError extends OrderError {
  constructor(params: { readonly orderId: string; readonly orderItemId: string }) {
    super('Este item não pode ser trocado: a falta já foi resolvida.', 409, ORDER_ITEM_NOT_SUBSTITUTABLE, params)
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

/**
 * O status foi salvo, mas o recibo não entrou na fila.
 *
 * Erro próprio porque o operador precisa agir: marcar o mesmo status de novo só reenfileira o recibo.
 * Um 500 genérico escondia que o pedido já tinha saído — e o segundo clique viraria 409.
 */
export class OrderReceiptEnqueueFailedError extends OrderError {
  constructor(orderId: string) {
    super('Status salvo, mas o recibo não foi enviado para emissão. Tente marcar de novo.', 503, ORDER_RECEIPT_ENQUEUE_FAILED, {
      orderId,
    })
  }
}

/**
 * O endereço fica além da última faixa configurada (spec §3.5, §3.3 `out_of_range`).
 *
 * 422 e não 404/409: o corpo do pedido é válido, o recurso existe — o que falha é a REGRA de
 * negócio "esse endereço não recebe entrega". `maxDistanceKm` vai no `details` para a tela mostrar
 * "entregamos até N km" sem uma segunda chamada.
 */
export class DeliveryOutOfRangeError extends OrderError {
  constructor(params: { readonly distanceKm: number; readonly maxDistanceKm: number }) {
    super(
      `Endereço a ${params.distanceKm} km está fora da área de entrega (até ${params.maxDistanceKm} km).`,
      422,
      DELIVERY_OUT_OF_RANGE,
      params,
    )
  }
}

/**
 * A tela recota na criação do pedido e a taxa mudou entre a cotação e o clique em confirmar
 * (spec §3.5): o painel pode ter editado as faixas no meio da compra.
 *
 * 409 e não 422: o corpo continua válido, e o preço não é mais o que a tela mostrou — o cliente
 * precisa ver o valor novo antes de pagar, não um erro genérico.
 */
export class DeliveryFeeChangedError extends OrderError {
  constructor(params: { readonly previousFeeInCents: number; readonly currentFeeInCents: number }) {
    super('A taxa de entrega mudou desde a última cotação.', 409, DELIVERY_FEE_CHANGED, params)
  }
}

/**
 * Sem `STORE_CEP`, sem faixas configuradas, ou sem coordenada nenhuma do cliente (D6, spec §3.3
 * `unavailable`). 422 porque o pedido em si está bem formado — a entrega é que não pode ser
 * calculada agora; a tela oferece retirada ou outro endereço.
 */
export class DeliveryUnavailableError extends OrderError {
  constructor(reason: string) {
    super('Não foi possível calcular a taxa de entrega para este endereço agora.', 422, DELIVERY_UNAVAILABLE, { reason })
  }
}
