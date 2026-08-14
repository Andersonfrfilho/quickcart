import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminUpdateOrderStatus } from '@/shared/api/client'

/**
 * Muda o status do pedido e recarrega TUDO que mostra status.
 *
 * Invalidava só a lista. Na tela de detalhe, isso fazia "Iniciar separação" mudar o banco e não mudar
 * nada na tela — o botão parecia quebrado, e a pessoa clicava de novo. O badge de pedidos aguardando
 * também precisa: confirmar um pedido tira ele da fila, e um contador que só atualiza no próximo ciclo
 * de 20s mostra trabalho que já foi feito.
 */
export type UpdateOrderStatusVariables = {
  readonly id: string
  readonly status: string
  /** Só com `status = delivery_failed`; a rota recusa a ocorrência sem ele e recusa ele sem ela. */
  readonly deliveryFailureReason?: string | undefined
}

export function useUpdateOrderStatusMutation(token: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status, deliveryFailureReason }: UpdateOrderStatusVariables) =>
      adminUpdateOrderStatus(token as string, { orderId: id, status, deliveryFailureReason }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-order-detail', variables.id] })
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-orders-count'] })
    },
  })
}
