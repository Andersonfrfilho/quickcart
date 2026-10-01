import { ORDER_STATUS, type OrderStatus } from '@/shared/api/api.types'

/**
 * Estados em que marcar item faz sentido.
 *
 * Antes de a separação começar, a lista é leitura: marcar item de um pedido que ninguém confirmou é
 * registrar trabalho que não aconteceu — e era o que fazia o botão "Iniciar separação" não parecer fazer
 * nada, porque a lista já estava aberta antes dele.
 *
 * Depois que a sacola sai ou o pedido termina, também é leitura: a marcação não muda mais nada no mundo,
 * e deixar editável só permite reescrever o passado sem efeito nenhum.
 */
const PICKING_ALLOWED_STATUSES: ReadonlySet<string> = new Set([
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.SEPARATED,
  /*
   * Esperando o cliente decidir sobre item em falta, a sacola continua na mão de alguém.
   *
   * Travar a lista aqui seria travar o trabalho: enquanto a resposta não chega, quem separa segue pegando
   * o resto — e pode achar mais um item em falta, que também precisa ser marcado.
   */
  ORDER_STATUS.AWAITING_CUSTOMER_DECISION,
])

/** Estados anteriores à separação — a lista está fechada, mas vai abrir. */
const BEFORE_PICKING_STATUSES: ReadonlySet<string> = new Set([
  ORDER_STATUS.PENDING_CONFIRMATION,
  ORDER_STATUS.CONFIRMED,
])

export const PICKING_STATE = {
  /** Ainda não começou: a tela explica o que falta fazer. */
  NOT_STARTED: 'not_started',
  UNLOCKED: 'unlocked',
  /** Acabou (saiu, foi retirado, concluído ou cancelado): só leitura. */
  CLOSED: 'closed',
} as const

export type PickingState = (typeof PICKING_STATE)[keyof typeof PICKING_STATE]

export function resolvePickingState(status: OrderStatus | string): PickingState {
  if (PICKING_ALLOWED_STATUSES.has(status)) return PICKING_STATE.UNLOCKED
  if (BEFORE_PICKING_STATUSES.has(status)) return PICKING_STATE.NOT_STARTED
  return PICKING_STATE.CLOSED
}
