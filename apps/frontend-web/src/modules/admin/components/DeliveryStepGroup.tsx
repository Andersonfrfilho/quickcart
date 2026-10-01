import { ORDER_STATUS, DELIVERY_ATTEMPT_OUTCOME, type OrderDeliveryAttempt } from '@/shared/api/api.types'
import { deliveryFailureReasonLabel } from '@/modules/admin/shared/orderStatusStyle'

/**
 * "Entrega" como UM degrau da esteira, com o detalhe da rua dobrado dentro.
 *
 * Os três passos do trajeto (saiu, a caminho, na porta) ocupavam metade da barra e diziam respeito a uma
 * fração dos pedidos: a maioria das lojas marca "saiu" e depois "entregue", então três chips ficavam
 * apagados para sempre, competindo em tamanho com etapas que todo pedido vive.
 *
 * Dobrado, e não removido: quem entrega em tempo real precisa dos degraus, e quem teve ocorrência precisa
 * do histórico de viagens — que não cabe na barra de jeito nenhum.
 */
const DELIVERY_SUB_STEPS: ReadonlyArray<{ readonly status: string; readonly label: string }> = [
  { status: ORDER_STATUS.OUT_FOR_DELIVERY, label: 'Saiu para entrega' },
  { status: ORDER_STATUS.IN_TRANSIT, label: 'A caminho' },
  { status: ORDER_STATUS.ARRIVED_AT_CUSTOMER, label: 'Chegou ao cliente' },
]

/** Statuses que acontecem DENTRO da entrega — os que o grupo representa quando é o passo atual. */
export const DELIVERY_GROUP_STATUSES: readonly string[] = [
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.ARRIVED_AT_CUSTOMER,
  ORDER_STATUS.DELIVERY_FAILED,
]

function formatMoment(moment: string): string {
  const date = new Date(moment)
  const isToday = date.toDateString() === new Date().toDateString()
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return isToday ? time : `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`
}

function attemptSummary(attempt: OrderDeliveryAttempt): string {
  if (attempt.outcome === DELIVERY_ATTEMPT_OUTCOME.DELIVERED) return 'Entregue'
  if (attempt.outcome === DELIVERY_ATTEMPT_OUTCOME.FAILED) {
    return attempt.failureReason ? `Não entregue — ${deliveryFailureReasonLabel(attempt.failureReason)}` : 'Não entregue'
  }
  return 'Na rua agora'
}

export type DeliveryStepGroupProps = {
  readonly status: string
  readonly attempts: readonly OrderDeliveryAttempt[]
  readonly isCurrent: boolean
  readonly isDone: boolean
}

export function DeliveryStepGroup({ status, attempts, isCurrent, isDone }: DeliveryStepGroupProps) {
  const isDeliveryFailed = status === ORDER_STATUS.DELIVERY_FAILED
  const currentSubIndex = DELIVERY_SUB_STEPS.findIndex((step) => step.status === status)

  const chipClass = isCurrent
    ? isDeliveryFailed
      ? 'bg-red-600 text-white dark:bg-red-500'
      : 'bg-primary text-primary-foreground'
    : isDone
      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
      : 'bg-muted text-muted-foreground'

  return (
    /*
     * `details` nativo, e não estado em React: o navegador já sabe abrir, fechar e responder ao teclado,
     * e o único estado que existiria aqui é exatamente o que ele guarda.
     *
     * Aberto por padrão quando a entrega é o passo ATUAL — é o momento em que alguém abre a tela
     * justamente para saber onde a sacola está.
     */
    <details open={isCurrent} className="group/delivery inline-block align-middle">
      <summary
        className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${chipClass}`}
        aria-current={isCurrent ? 'step' : undefined}
      >
        <span aria-hidden="true">{isDone ? '✓' : isCurrent ? (isDeliveryFailed ? '⚠' : '●') : '○'}</span>
        Entrega
        {/* Só a seta gira; o rótulo não muda, para o degrau não mudar de tamanho ao abrir. */}
        <span aria-hidden="true" className="transition-transform group-open/delivery:rotate-90">
          ›
        </span>
      </summary>

      <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/40 p-3">
        <ol className="space-y-1" aria-label="Etapas da entrega">
          {DELIVERY_SUB_STEPS.map((step, index) => {
            /*
             * Numa ocorrência o status não diz em que parada a viagem parou, mas diz que ela COMEÇOU:
             * existe tentativa aberta, e o carro saiu. Só "Saiu para entrega" fica cumprido — marcar
             * "chegou ao cliente" seria inventar o que ninguém registrou.
             */
            const isSubDone =
              isDone || (currentSubIndex >= 0 && index < currentSubIndex) || (isDeliveryFailed && index === 0)
            const isSubCurrent = index === currentSubIndex

            return (
              <li key={step.status} className="flex items-center gap-2 text-xs">
                <span aria-hidden="true">{isSubDone ? '✓' : isSubCurrent ? '●' : '○'}</span>
                <span className={isSubCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>

        {/*
          O histórico só aparece com mais de uma viagem.
          Numa entrega única ele repetiria, em forma de lista, o que os degraus acima já dizem.
        */}
        {attempts.length > 1 && (
          <ul className="space-y-1 border-t border-border pt-2" aria-label="Tentativas de entrega">
            {attempts.map((attempt) => (
              <li key={attempt.attempt} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-medium text-foreground">{attempt.attempt}ª tentativa</span>
                <span className="text-muted-foreground">{formatMoment(attempt.startedAt)}</span>
                <span
                  className={
                    attempt.outcome === DELIVERY_ATTEMPT_OUTCOME.FAILED
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-muted-foreground'
                  }
                >
                  {attemptSummary(attempt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
