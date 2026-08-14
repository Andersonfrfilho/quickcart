import { useState } from 'react'
import { Button } from '@/components/ui'
import { DELIVERY_FAILURE_REASON } from '@/shared/api/api.types'
import { deliveryFailureReasonLabel } from '@/modules/admin/shared/orderStatusStyle'

/**
 * Registrar ocorrência é o único passo que exige uma segunda informação — e a rota recusa sem ela.
 *
 * Um botão só, mandando `delivery_failed` cru, tomaria um 400 que a tela não sabe explicar; e gravar
 * primeiro a ocorrência e o motivo depois deixaria o pedido parado num estado que ninguém consegue ler.
 * Então o motivo é a PRÓPRIA escolha: cada botão aqui é uma ocorrência inteira, num clique.
 *
 * Fica fechado até alguém precisar. Cinco botões vermelhos abertos ao lado de "Confirmar entrega"
 * disputariam a olhada com o desfecho normal, que é o que acontece na maioria das viagens.
 */

/**
 * Os dois grupos espelham `isRetryableDeliveryFailure` da API — que continua sendo quem decide.
 *
 * A separação aqui é aviso, não regra: depois de gravada a ocorrência, os botões seguintes vêm de
 * `allowedNextStatuses`, então uma divergência entre estas listas e o servidor atrasa a leitura da tela,
 * nunca libera uma transição que o servidor recusa.
 */
const RETRYABLE_REASONS: readonly string[] = [
  DELIVERY_FAILURE_REASON.CUSTOMER_ABSENT,
  DELIVERY_FAILURE_REASON.WRONG_ADDRESS,
  DELIVERY_FAILURE_REASON.RETURNED,
]

const TERMINAL_REASONS: readonly string[] = [DELIVERY_FAILURE_REASON.REFUSED, DELIVERY_FAILURE_REASON.LOST]

export type DeliveryFailureActionProps = {
  readonly isUpdatingStatus: boolean
  readonly onRegister: (deliveryFailureReason: string) => void
}

export function DeliveryFailureAction({ isUpdatingStatus, onRegister }: DeliveryFailureActionProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <div className="print:hidden">
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => setIsOpen(true)}
        >
          <span aria-hidden="true" className="mr-1.5">
            ⚠️
          </span>
          Registrar ocorrência
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 print:hidden">
      <div>
        <p className="font-semibold text-destructive">⚠️ O que aconteceu na entrega?</p>
        {/* O motivo é interno: ele decide a próxima tentativa e o estoque, e não vai no recado do cliente. */}
        <p className="mt-1 text-sm text-muted-foreground">
          O cliente recebe um aviso neutro de que a entrega não foi concluída — o motivo fica só para a loja.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dá para tentar de novo
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {RETRYABLE_REASONS.map((reason) => (
            <Button
              key={reason}
              variant="outline"
              size="sm"
              disabled={isUpdatingStatus}
              onClick={() => onRegister(reason)}
            >
              {deliveryFailureReasonLabel(reason)}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Encerra a entrega</p>
        {/* Dito antes do clique: extraviado é o único que não devolve a sacola à prateleira no cancelamento. */}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {TERMINAL_REASONS.map((reason) => (
            <Button
              key={reason}
              variant="outline"
              size="sm"
              disabled={isUpdatingStatus}
              className="border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onRegister(reason)}
            >
              {deliveryFailureReasonLabel(reason)}
            </Button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Depois de recusa ou extravio, o pedido só pode ser cancelado — e o extraviado não volta ao estoque.
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
        Voltar
      </Button>
    </div>
  )
}
