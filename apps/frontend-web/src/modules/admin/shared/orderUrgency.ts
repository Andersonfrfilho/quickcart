import { ORDER_STATUS, type OrderStatus } from '@/shared/api/api.types'

/**
 * Quanto tempo um pedido pode ficar parado antes de virar problema.
 *
 * Compra de supermercado tem janela curta: quem pediu está esperando para receber ou buscar, e vinte
 * minutos sem ninguém confirmar já é reclamação. Os números são o que a loja consegue sustentar, não
 * uma verdade universal — se a operação mudar, mudam aqui, num lugar só.
 */
const ATTENTION_AFTER_MINUTES = 10
const LATE_AFTER_MINUTES = 30

export const ORDER_URGENCY = {
  /** Chegou agora: ninguém precisa correr. */
  FRESH: 'fresh',
  /** Esperando o suficiente para alguém olhar. */
  ATTENTION: 'attention',
  /** Esperando demais. É este que pisca. */
  LATE: 'late',
  /** Alguém já agiu: sai do radar de urgência, mesmo que seja antigo. */
  HANDLED: 'handled',
} as const

export type OrderUrgency = (typeof ORDER_URGENCY)[keyof typeof ORDER_URGENCY]

/**
 * Urgência de um pedido pela espera, e só enquanto NINGUÉM agiu.
 *
 * "Não visualizado" aqui é derivado do status, não de um registro de leitura: `pending_confirmation`
 * significa que ninguém confirmou ainda. Inventar uma coluna de "visto" daria um sinal mais bonito e
 * mais fácil de mentir — bastaria alguém abrir o detalhe para o pedido parecer resolvido sem ter sido.
 */
export function resolveOrderUrgency(params: {
  readonly status: OrderStatus
  readonly createdAt: string
  readonly now: number
}): OrderUrgency {
  if (params.status !== ORDER_STATUS.PENDING_CONFIRMATION) return ORDER_URGENCY.HANDLED

  const waitingMinutes = (params.now - new Date(params.createdAt).getTime()) / 60_000
  if (waitingMinutes >= LATE_AFTER_MINUTES) return ORDER_URGENCY.LATE
  if (waitingMinutes >= ATTENTION_AFTER_MINUTES) return ORDER_URGENCY.ATTENTION
  return ORDER_URGENCY.FRESH
}

/**
 * "há 25 min", "há 3 h", "há 2 d".
 *
 * Relativo porque a pergunta do operador é "quanto tempo essa pessoa está esperando", e responder com
 * "14:32" obriga ele a fazer a subtração de cabeça. O horário exato fica no `title`, para quando
 * precisar registrar.
 */
export function formatWaitingFor(createdAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`

  return `há ${Math.floor(hours / 24)} d`
}
