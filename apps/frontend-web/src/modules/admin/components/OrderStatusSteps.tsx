import { ORDER_STATUS, type OrderDeliveryAttempt } from '@/shared/api/api.types'
import { deliveryFailureReasonLabel, orderStatusLabel } from '@/modules/admin/shared/orderStatusStyle'
import { DeliveryStepGroup, DELIVERY_GROUP_STATUSES } from '@/modules/admin/components/DeliveryStepGroup'

/**
 * A jornada do pedido, do recebimento à entrega, com o passo atual em destaque.
 *
 * A tela tinha barra de progresso só da SEPARAÇÃO, que é uma etapa entre seis. Quem abre um pedido precisa
 * saber onde ele está na esteira inteira — e essa informação existia apenas como uma etiqueta de status, que
 * diz o estado mas não diz o que já passou nem o que falta.
 *
 * Os passos dependem do tipo de entrega: uma retirada nunca "sai para entrega", e mostrar esse passo
 * apagado sugeriria uma etapa que não vai acontecer.
 */
/**
 * O trajeto na rua é UM degrau — `DELIVERY_GROUP_STEP` — que se abre nos três de dentro.
 *
 * Como degraus soltos, "saiu", "a caminho" e "na porta" eram três oitavos da barra para uma etapa que a
 * maioria das lojas marca de uma vez só. Dobrados, a esteira mostra as cinco etapas que todo pedido vive,
 * e quem acompanha em tempo real abre o que precisa.
 */
const DELIVERY_GROUP_STEP = 'delivery_group'

const DELIVERY_STEPS: readonly string[] = [
  ORDER_STATUS.PENDING_CONFIRMATION,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.SEPARATED,
  DELIVERY_GROUP_STEP,
  ORDER_STATUS.COMPLETED,
]

const PICKUP_STEPS: readonly string[] = [
  ORDER_STATUS.PENDING_CONFIRMATION,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.SEPARATED,
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.COMPLETED,
]

/** Rótulo curto: no passo, "Aguardando confirmação" quebraria a linha em telas estreitas. */
const STEP_SHORT_LABELS: Record<string, string> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: 'Recebido',
  [ORDER_STATUS.CONFIRMED]: 'Confirmado',
  [ORDER_STATUS.PREPARING]: 'Separando',
  [ORDER_STATUS.SEPARATED]: 'Separado',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'Na loja',
  [ORDER_STATUS.COMPLETED]: 'Concluído',
}

/**
 * O último passo tem nome diferente conforme quem se moveu.
 *
 * O status é o mesmo, o fato não: numa retirada ninguém entregou nada, e "Entregue" no fim da esteira
 * de balcão descreve uma viagem que não houve.
 */
const COMPLETED_STEP_LABELS: Record<string, string> = { delivery: 'Entregue', pickup: 'Retirado' }

function stepShortLabel(params: { readonly step: string; readonly deliveryType: string }): string {
  if (params.step === ORDER_STATUS.COMPLETED) {
    return COMPLETED_STEP_LABELS[params.deliveryType] ?? STEP_SHORT_LABELS[ORDER_STATUS.COMPLETED]!
  }
  return STEP_SHORT_LABELS[params.step] ?? orderStatusLabel(params.step)
}

export type OrderStatusStepsProps = {
  readonly status: string
  readonly deliveryType: string
  /**
   * A barra do pedido inteiro. Desligada enquanto a separação está em andamento, porque nesse momento a
   * barra visível é a dos itens — duas barras empilhadas disputam a mesma olhada e nenhuma vence.
   */
  readonly withProgressBar: boolean
  /** Só chega preenchido com `status = delivery_failed`; é ele que explica a esteira parada. */
  readonly deliveryFailureReason?: string | null
  /** Histórico das viagens, exibido dentro do degrau "Entrega". Vazio numa retirada. */
  readonly deliveryAttempts?: readonly OrderDeliveryAttempt[]
}

export function OrderStatusSteps({
  status,
  deliveryType,
  withProgressBar,
  deliveryFailureReason,
  deliveryAttempts = [],
}: OrderStatusStepsProps) {
  /*
   * Cancelado não é um passo da esteira: é a esteira interrompida.
   *
   * Encaixá-lo no fim faria parecer um destino normal, e desenhar os passos anteriores como "cumpridos"
   * contaria uma história que não terminou. Uma linha só, dizendo o que aconteceu.
   */
  if (status === ORDER_STATUS.CANCELLED) {
    return (
      <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300">
        ❌ Pedido cancelado — a esteira foi interrompida.
      </p>
    )
  }

  const steps = deliveryType === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS

  /*
   * Esperar o cliente decidir não é um degrau: é a separação PARADA.
   *
   * Como degrau próprio, somaria à esteira uma etapa que a maioria dos pedidos nunca vive. Fora da lista e
   * sem mais nada, `indexOf` devolveria -1 e a esteira inteira apareceria apagada, como se o pedido tivesse
   * acabado de chegar. Então o passo continua sendo "Separando" — pintado de parado, e explicado acima.
   */
  const isAwaitingCustomer = status === ORDER_STATUS.AWAITING_CUSTOMER_DECISION

  /*
   * Ocorrência também não é degrau: é a viagem interrompida, e não se sabe em qual parada.
   *
   * Como passo próprio ficaria no fim, ao lado de "Entregue", sugerindo que ela vem DEPOIS da entrega.
   * O passo continua sendo o grupo "Entrega" — pintado de parado, com o motivo escrito acima e o
   * histórico das viagens dobrado dentro dele.
   */
  const isDeliveryFailed = status === ORDER_STATUS.DELIVERY_FAILED
  const stoppedAtStep = isAwaitingCustomer
    ? ORDER_STATUS.PREPARING
    : DELIVERY_GROUP_STATUSES.includes(status)
      ? DELIVERY_GROUP_STEP
      : status
  const currentIndex = steps.indexOf(stoppedAtStep)
  const currentStepClass = isAwaitingCustomer
    ? 'bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950'
    : isDeliveryFailed
      ? 'bg-red-600 text-white dark:bg-red-500 dark:text-white'
      : 'bg-primary text-primary-foreground'

  // Marca de parado além da cor: quem não distingue matiz precisa ver que a esteira travou.
  const currentStepMarker = isAwaitingCustomer ? '⏸' : isDeliveryFailed ? '⚠' : '●'

  return (
    <div className="space-y-2">
      {isAwaitingCustomer && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          ⏸️ Separação parada: o cliente foi avisado da falta e ainda não respondeu se quer seguir.
        </p>
      )}
      {isDeliveryFailed && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300">
          ⚠️ Entrega não concluída
          {deliveryFailureReason ? `: ${deliveryFailureReasonLabel(deliveryFailureReason)}.` : '.'}
        </p>
      )}
      {/*
        A barra é resumo VISUAL: os passos abaixo já carregam o significado para o leitor de tela, e
        anunciar "60%" além de "Separado, passo atual" seria a mesma informação duas vezes.

        A proporção é sobre os intervalos (`length - 1`), não sobre os passos: "Recebido" é o começo da
        esteira, e uma barra já iniciada num pedido que ninguém confirmou sugeriria trabalho feito.
      */}
      {withProgressBar && (
        <progress
          aria-hidden="true"
          className="order-macro-progress"
          value={currentIndex > 0 ? currentIndex : 0}
          max={steps.length - 1}
        />
      )}

      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Progresso do pedido">
      {steps.map((step, index) => {
        /*
         * Status fora da lista (deploy escalonado, front antigo) faz `currentIndex` ser -1: nesse caso
         * nenhum passo é marcado como cumprido, em vez de todos parecerem pendentes por acaso.
         */
        const isDone = currentIndex >= 0 && index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <li key={step} className="flex items-center gap-1">
            {step === DELIVERY_GROUP_STEP ? (
              <DeliveryStepGroup status={status} attempts={deliveryAttempts} isCurrent={isCurrent} isDone={isDone} />
            ) : (
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isCurrent
                  ? currentStepClass
                  : isDone
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
              }`}
              title={isCurrent ? orderStatusLabel(status) : orderStatusLabel(step)}
            >
              {/* Marca de cumprido além da cor: passo concluído precisa se distinguir sem depender de matiz. */}
              <span aria-hidden="true">{isDone ? '✓' : isCurrent ? currentStepMarker : '○'}</span>
              {stepShortLabel({ step, deliveryType })}
            </span>
            )}

            {/* Conector entre passos, nunca depois do último — traço solto sugere etapa que não existe. */}
            {index < steps.length - 1 && (
              <span aria-hidden="true" className={`h-px w-3 ${isDone ? 'bg-emerald-400' : 'bg-border'}`} />
            )}
          </li>
          )
        })}
      </ol>
    </div>
  )
}
