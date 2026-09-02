import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminNotifyUnavailableItems } from '@/shared/api/client'

/**
 * Avisa o cliente das faltas do pedido, em uma mensagem só.
 *
 * Separada de marcar item porque são decisões diferentes: marcar é registro interno de quem separa, avisar
 * é falar com o cliente. Antes as duas eram a mesma coisa, e cada item marcado virava uma mensagem.
 */
export function useNotifyUnavailableItemsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => adminNotifyUnavailableItems(orderId),
    onSuccess: (_result, orderId) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-order-detail', orderId] })
    },
  })
}
