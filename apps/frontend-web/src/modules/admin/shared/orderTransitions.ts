import { ORDER_STATUS, type DeliveryType, type OrderStatus } from '@/shared/api/api.types'

/** Esteira crua, sem saber se o pedido é entrega ou retirada. */
const NEXT_STATUS: Record<string, readonly string[]> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.SEPARATED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SEPARATED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.READY_FOR_PICKUP, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.READY_FOR_PICKUP]: [ORDER_STATUS.COMPLETED],
}

/** Passos que só existem para um tipo de entrega. */
const STATUS_REQUIRES_DELIVERY_TYPE: Readonly<Record<string, DeliveryType>> = {
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'delivery',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'pickup',
}

/**
 * Próximos passos possíveis para ESTE pedido.
 *
 * A esteira sozinha não sabe o que o cliente escolheu, e a tela oferecia "Saiu para entrega" e "Pronto
 * para retirada" lado a lado em todo pedido separado. Metade dos botões estava sempre errada: tocar em
 * "saiu para entrega" numa retirada avisa o cliente de que a compra está indo até ele e deixa a sacola
 * no balcão esperando — e o erro só aparece quando alguém liga reclamando.
 */
export function nextStatusesFor(params: {
  readonly status: OrderStatus | string
  readonly deliveryType: DeliveryType | string
}): readonly string[] {
  return (NEXT_STATUS[params.status] ?? []).filter((next) => {
    const required = STATUS_REQUIRES_DELIVERY_TYPE[next]
    return required === undefined || required === params.deliveryType
  })
}

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
const PICKING_ALLOWED_STATUSES: ReadonlySet<string> = new Set([ORDER_STATUS.PREPARING, ORDER_STATUS.SEPARATED])

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
