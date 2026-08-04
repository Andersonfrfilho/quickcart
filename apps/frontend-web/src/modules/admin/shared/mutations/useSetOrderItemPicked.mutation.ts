import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminSetOrderItemPicked } from '@/shared/api/client'
import type { ApiItemResponse, OrderDetail } from '@/shared/api/api.types'

export type SetOrderItemPickedParams = {
  readonly orderId: string
  /** Ausente = todos os itens ("marcar todos" / "limpar marcações"). */
  readonly itemId?: string | undefined
  readonly picked: boolean
}

/**
 * Marca item separado, com resposta imediata na tela.
 *
 * A marcação otimista não é enfeite: quem separa está de pé no corredor com o celular na mão, e um
 * checkbox que só reage depois da rede faz a pessoa tocar de novo achando que não pegou. O servidor é
 * quem manda no fim — se a requisição falhar, o cache volta ao que era e o item desmarca sozinho.
 *
 * Não invalida `admin-orders`: separar não muda total nem situação do pedido, e recarregar a lista a
 * cada item marcado seria uma consulta por toque numa compra de trinta itens.
 */
export function useSetOrderItemPickedMutation(token: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SetOrderItemPickedParams) => adminSetOrderItemPicked(token as string, params),

    onMutate: async (params) => {
      const queryKey = ['admin-order-detail', params.orderId]
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ApiItemResponse<OrderDetail>>(queryKey)

      queryClient.setQueryData<ApiItemResponse<OrderDetail>>(queryKey, (current) => {
        if (!current) return current
        const stamp = params.picked ? new Date().toISOString() : null
        return {
          ...current,
          data: {
            ...current.data,
            items: current.data.items.map((item) => {
              const isTarget = params.itemId === undefined || item.id === params.itemId
              if (!isTarget) return item
              // Item em falta não entra ao marcar — a mesma regra que o servidor aplica.
              if (params.picked && item.unavailableAt !== null) return item
              return { ...item, pickedAt: stamp }
            }),
          },
        }
      })

      return { previous }
    },

    onError: (_error, params, context) => {
      // Volta ao que era: melhor o item desmarcar sozinho que a tela afirmar um trabalho que não gravou.
      if (context?.previous) {
        queryClient.setQueryData(['admin-order-detail', params.orderId], context.previous)
      }
    },

    onSettled: (_result, _error, params) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-order-detail', params.orderId] })
    },
  })
}
