/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const ORDER_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  /**
   * Separado: os itens estão na sacola e o pedido espera entregador ou cliente.
   *
   * Faltava um estado entre "preparando" e "saiu para entrega": a esteira ia direto de um ao outro, e
   * quem terminava de separar um pedido de entrega só tinha o botão "saiu para entrega" — que é mentira
   * enquanto ninguém saiu. Sem esse degrau, quem olha a lista não distingue o que está pronto do que
   * ainda está sendo montado, que é a pergunta do balcão inteiro.
   */
  SEPARATED: 'separated',
  /**
   * A separação parou porque falta item e a decisão é do cliente.
   *
   * Não é um degrau da esteira, é um desvio: o pedido sai de "separando" e volta para lá quando o
   * cliente responde, ou termina em "cancelado" quando ele desiste. Sem esse estado, um pedido com
   * item em falta ficava indistinguível de um pedido sendo separado normalmente — e a sacola parada
   * no balcão esperando resposta não aparecia em lugar nenhum da lista.
   *
   * Entrar aqui NÃO é ação de operador: é efeito de "Avisar o cliente", que é quem manda a pergunta.
   * Por isso o estado não aparece como destino em `ORDER_STATUS_TRANSITIONS` — só como origem.
   */
  AWAITING_CUSTOMER_DECISION: 'awaiting_customer_decision',
  /** Deixou a loja. A partir daqui o pedido está com o entregador, não com quem separa. */
  OUT_FOR_DELIVERY: 'out_for_delivery',
  /**
   * A caminho DESTE endereço.
   *
   * Não é o mesmo que "saiu da loja": o entregador sai com quatro sacolas, e a terceira delas passa
   * quarenta minutos na moto antes de virar a esquina do cliente. Sem este degrau, "saiu para entrega"
   * era a resposta tanto para quem ia receber em cinco minutos quanto para quem ia esperar uma hora.
   */
  IN_TRANSIT: 'in_transit',
  /** Na porta. É o aviso que faz alguém descer, e o único que tem hora marcada de verdade. */
  ARRIVED_AT_CUSTOMER: 'arrived_at_customer',
  READY_FOR_PICKUP: 'ready_for_pickup',
  /**
   * A entrega não aconteceu, e o porquê está em `deliveryFailureReason`.
   *
   * Um status com motivo, e não um status por ocorrência: "extraviado", "cliente ausente" e "endereço
   * errado" são o mesmo fato para a esteira — o pedido saiu e voltou sem ser entregue. O que muda entre
   * eles é o motivo e se dá para tentar de novo, e isso é dado, não estrutura. Motivo novo é uma linha
   * em `DELIVERY_FAILURE_REASON`, não uma migration com rótulo, cor e regra de transição em cada tela.
   */
  DELIVERY_FAILED: 'delivery_failed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

/**
 * Por que a entrega não aconteceu. Só existe com `status = delivery_failed`.
 *
 * O motivo não é só rótulo: é ele que diz se o pedido ainda pode andar. Cliente que não estava em casa
 * recebe amanhã; cliente que recusou a sacola não vai receber de novo, e oferecer "sair para entrega"
 * ali seria oferecer um caminho que termina em outra viagem perdida.
 */
export const DELIVERY_FAILURE_REASON = {
  /** Ninguém atendeu. A sacola volta inteira e a segunda tentativa é o desfecho normal. */
  CUSTOMER_ABSENT: 'customer_absent',
  /** Endereço não encontrado, incompleto ou errado. Corrigir e sair de novo é o caminho. */
  WRONG_ADDRESS: 'wrong_address',
  /** Voltou para a loja sem tentativa concluída (rota interrompida, moto quebrada, chuva). */
  RETURNED: 'returned',
  /** O cliente viu e não quis. Tentar de novo é insistir com quem já disse não. */
  REFUSED: 'refused',
  /** A mercadoria sumiu no caminho. Não há o que reentregar, e não há o que devolver à prateleira. */
  LOST: 'lost',
} as const

export type DeliveryFailureReason = (typeof DELIVERY_FAILURE_REASON)[keyof typeof DELIVERY_FAILURE_REASON]

/**
 * Ocorrência da qual o pedido ainda pode sair para entrega de novo.
 *
 * Lista de permissão, não de negação: motivo novo nasce finalizante até alguém decidir que reentregar
 * faz sentido nele. O erro barato é a loja precisar de um clique a mais; o caro é a esteira oferecer
 * uma segunda viagem para um pedido que nunca vai chegar.
 */
const RETRYABLE_DELIVERY_FAILURE_REASONS: ReadonlySet<string> = new Set([
  DELIVERY_FAILURE_REASON.CUSTOMER_ABSENT,
  DELIVERY_FAILURE_REASON.WRONG_ADDRESS,
  DELIVERY_FAILURE_REASON.RETURNED,
])

export function isRetryableDeliveryFailure(reason: string | null | undefined): boolean {
  return reason !== null && reason !== undefined && RETRYABLE_DELIVERY_FAILURE_REASONS.has(reason)
}

/**
 * A mercadoria extraviada não volta para a prateleira.
 *
 * Cancelar devolve estoque porque a sacola voltou para a loja — é o caso de quase toda ocorrência. Com
 * `lost` não voltou nada: repor ali criaria estoque de um produto que não existe, e o próximo cliente
 * compraria o que ninguém tem para separar.
 */
export function shouldRestoreStockOnCancel(params: {
  readonly status: string
  readonly deliveryFailureReason: string | null
}): boolean {
  return !(
    params.status === ORDER_STATUS.DELIVERY_FAILED &&
    params.deliveryFailureReason === DELIVERY_FAILURE_REASON.LOST
  )
}

export const DELIVERY_TYPE = {
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
} as const

export type DeliveryType = (typeof DELIVERY_TYPE)[keyof typeof DELIVERY_TYPE]

export const PAYMENT_METHOD = {
  PIX: 'pix',
  CARD_ON_DELIVERY: 'card_on_delivery',
  CASH: 'cash',
} as const

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]

export const RECEIPT_PREFERENCE = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  BOTH: 'both',
} as const

export type ReceiptPreference = (typeof RECEIPT_PREFERENCE)[keyof typeof RECEIPT_PREFERENCE]

export const ORDER_IDEMPOTENCY_CACHE_PREFIX = 'order:idempotency:'
export const ORDER_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
export const ORDER_IDEMPOTENCY_PENDING_SENTINEL = 'pending'
export const ORDER_IDEMPOTENCY_POLL_INTERVAL_MS = 100
export const ORDER_IDEMPOTENCY_POLL_TIMEOUT_MS = 5000

export const LIST_DEFAULT_PAGE = 1
export const LIST_DEFAULT_PER_PAGE = 20
export const LIST_MAX_PER_PAGE = 100

export const ORDER_SORTABLE_FIELDS = ['createdAt', 'totalInCents', 'status'] as const
export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS) as [OrderStatus, ...OrderStatus[]]
export const DELIVERY_FAILURE_REASON_VALUES = Object.values(DELIVERY_FAILURE_REASON) as [
  DeliveryFailureReason,
  ...DeliveryFailureReason[],
]
export const DELIVERY_TYPE_VALUES = Object.values(DELIVERY_TYPE) as [DeliveryType, ...DeliveryType[]]
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD) as [PaymentMethod, ...PaymentMethod[]]
export const RECEIPT_PREFERENCE_VALUES = Object.values(RECEIPT_PREFERENCE) as [ReceiptPreference, ...ReceiptPreference[]]
