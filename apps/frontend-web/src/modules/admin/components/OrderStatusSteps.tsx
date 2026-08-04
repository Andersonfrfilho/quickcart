import { ORDER_STATUS } from '@/shared/api/api.types'
import { orderStatusLabel } from '@/modules/admin/shared/orderStatusStyle'

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
const DELIVERY_STEPS: readonly string[] = [
  ORDER_STATUS.PENDING_CONFIRMATION,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.SEPARATED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
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
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Em entrega',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'Na loja',
  [ORDER_STATUS.COMPLETED]: 'Concluído',
}

export type OrderStatusStepsProps = {
  readonly status: string
  readonly deliveryType: string
  /**
   * A barra do pedido inteiro. Desligada enquanto a separação está em andamento, porque nesse momento a
   * barra visível é a dos itens — duas barras empilhadas disputam a mesma olhada e nenhuma vence.
   */
  readonly withProgressBar: boolean
}

export function OrderStatusSteps({ status, deliveryType, withProgressBar }: OrderStatusStepsProps) {
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
  const currentIndex = steps.indexOf(status)

  return (
    <div className="space-y-2">
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
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isDone
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
              }`}
              title={orderStatusLabel(step)}
            >
              {/* Marca de cumprido além da cor: passo concluído precisa se distinguir sem depender de matiz. */}
              <span aria-hidden="true">{isDone ? '✓' : isCurrent ? '●' : '○'}</span>
              {STEP_SHORT_LABELS[step] ?? orderStatusLabel(step)}
            </span>

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
