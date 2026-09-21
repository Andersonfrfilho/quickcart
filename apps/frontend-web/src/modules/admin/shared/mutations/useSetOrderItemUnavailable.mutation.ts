import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminSetOrderItemUnavailable } from '@/shared/api/client'

export type SetOrderItemUnavailableParams = {
  readonly orderId: string
  readonly itemId: string
  readonly unavailable: boolean
}

/**
 * Marca um item como acabado. Não é marca de rascunho: o servidor refaz o total e avisa o cliente.
 *
 * Invalida o detalhe E a lista: o total do pedido mudou, e a lista mostra total — deixar a lista com o
 * valor antigo faria a mesma compra aparecer com dois preços em duas telas do mesmo painel.
 */
export function useSetOrderItemUnavailableMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SetOrderItemUnavailableParams) => adminSetOrderItemUnavailable(params),
    onSuccess: (_result, params) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-order-detail', params.orderId] })
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-orders-count'] })
    },
  })
}
