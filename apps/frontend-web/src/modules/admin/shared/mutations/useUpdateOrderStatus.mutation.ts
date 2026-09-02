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
export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminUpdateOrderStatus(id, status),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-order-detail', variables.id] })
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-orders-count'] })
    },
  })
}
