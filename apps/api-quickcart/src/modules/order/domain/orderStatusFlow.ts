/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A esteira de status do pedido — a regra vive aqui, no servidor.
 *
 * Ela existia só no frontend, como mapa que decidia quais botões desenhar. A rota aceitava qualquer valor
 * do enum sem olhar o estado atual, então uma aba aberta desde a manhã, um `curl` ou um duplo clique
 * movia pedido concluído de volta para "aguardando confirmação" — e cada transição dispara mensagem ao
 * cliente, então o estrago sai da tela e chega no WhatsApp de quem comprou.
 *
 * Guarda-corpo no cliente é conveniência; no servidor é garantia. O frontend continua desenhando botões,
 * mas a partir da lista que a API devolve, para não existirem duas verdades sobre a mesma esteira.
 */

import {
  DELIVERY_TYPE,
  ORDER_STATUS,
  isRetryableDeliveryFailure,
  type OrderStatus,
} from '@/modules/order/shared/Order.constant'

/**
 * Para onde cada estado pode ir. Ausente do mapa = estado final.
 *
 * `completed` e `cancelled` não têm saída de propósito: reabrir pedido concluído ou ressuscitar cancelado
 * não é transição, é outra operação — e se um dia precisar existir, precisa de nome, registro e provavelmente
 * autorização diferente.
 */
const ORDER_STATUS_TRANSITIONS: Readonly<Record<string, readonly OrderStatus[]>> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.SEPARATED, ORDER_STATUS.CANCELLED],
  /**
   * O desvio da falta. Só aparece como ORIGEM: entrar aqui não é botão, é efeito de "Avisar o cliente".
   *
   * As três saídas existem porque as três acontecem: o cliente responde que segue (volta a separar), o
   * cliente desiste (cancela), ou ninguém respondeu e a loja decide sozinha — que é o handoff sem o qual
   * um cliente calado deixaria a sacola parada para sempre.
   *
   * Volta sempre para `preparing`, mesmo tendo saído de `separated`: sem um item, a sacola precisa ser
   * revisitada de qualquer forma, e "separado" seria afirmar uma conferência que não aconteceu.
   */
  [ORDER_STATUS.AWAITING_CUSTOMER_DECISION]: [
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.SEPARATED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.SEPARATED]: [
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.CANCELLED,
  ],
  /**
   * O trajeto anda para frente e pode pular degrau — nunca voltar.
   *
   * Pular é sempre verdade sobre o mundo: quem chegou saiu, quem entregou chegou. Quem marca só no fim
   * do dia fecha o pedido em um clique, e quem acompanha em tempo real usa os degraus do meio. Exigir os
   * três cliques faria a esteira mentir do jeito oposto — um monte de pedido eternamente "saiu para
   * entrega" porque ninguém parou a moto para marcar "em trânsito".
   *
   * `cancelled` não aparece daqui: com a sacola na rua, o desfecho ruim é ocorrência, não cancelamento.
   * Cancelar continua possível — a partir da ocorrência, que é onde o motivo fica registrado.
   */
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [
    ORDER_STATUS.IN_TRANSIT,
    ORDER_STATUS.ARRIVED_AT_CUSTOMER,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.DELIVERY_FAILED,
  ],
  [ORDER_STATUS.IN_TRANSIT]: [
    ORDER_STATUS.ARRIVED_AT_CUSTOMER,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.DELIVERY_FAILED,
  ],
  [ORDER_STATUS.ARRIVED_AT_CUSTOMER]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERY_FAILED],
  [ORDER_STATUS.READY_FOR_PICKUP]: [ORDER_STATUS.COMPLETED],
}

/**
 * As saídas da ocorrência dependem do MOTIVO, não do status.
 *
 * Por isso não estão no mapa acima: `delivery_failed` sozinho não responde se cabe outra viagem. Cliente
 * ausente recebe amanhã; cliente que recusou a sacola não recebe de novo, e extraviado não tem o que
 * entregar. Oferecer "sair para entrega" nos dois últimos seria oferecer uma viagem perdida.
 */
const DELIVERY_FAILED_RETRYABLE_NEXT: readonly OrderStatus[] = [
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.CANCELLED,
]
const DELIVERY_FAILED_TERMINAL_NEXT: readonly OrderStatus[] = [ORDER_STATUS.CANCELLED]

/**
 * Passos que só existem para um tipo de entrega.
 *
 * "Saiu para entrega" numa retirada avisa o cliente de que a compra está indo até ele e deixa a sacola no
 * balcão esperando. O erro só aparece quando alguém liga reclamando, então não pode depender de a tela ter
 * escondido o botão.
 */
const STATUS_REQUIRES_DELIVERY_TYPE: Readonly<Record<string, string>> = {
  [ORDER_STATUS.OUT_FOR_DELIVERY]: DELIVERY_TYPE.DELIVERY,
  [ORDER_STATUS.READY_FOR_PICKUP]: DELIVERY_TYPE.PICKUP,
}

export type OrderStatusFlowParams = {
  readonly status: string
  readonly deliveryType: string
  /** Só preenchido em `delivery_failed`, e é o que decide se ainda cabe outra tentativa. */
  readonly deliveryFailureReason?: string | null | undefined
}

function nextStatusesFor(params: OrderStatusFlowParams): readonly OrderStatus[] {
  if (params.status === ORDER_STATUS.DELIVERY_FAILED) {
    return isRetryableDeliveryFailure(params.deliveryFailureReason)
      ? DELIVERY_FAILED_RETRYABLE_NEXT
      : DELIVERY_FAILED_TERMINAL_NEXT
  }

  return ORDER_STATUS_TRANSITIONS[params.status] ?? []
}

/** Próximos estados válidos para ESTE pedido. É o que a API devolve para a tela desenhar. */
export function allowedNextStatuses(params: OrderStatusFlowParams): readonly OrderStatus[] {
  return nextStatusesFor(params).filter((next) => {
    const required = STATUS_REQUIRES_DELIVERY_TYPE[next]
    return required === undefined || required === params.deliveryType
  })
}

export function canTransitionTo(params: OrderStatusFlowParams & { readonly nextStatus: string }): boolean {
  return allowedNextStatuses(params).some((allowed) => allowed === params.nextStatus)
}
