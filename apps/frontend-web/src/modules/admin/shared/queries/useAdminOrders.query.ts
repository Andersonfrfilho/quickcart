import { useQuery } from '@tanstack/react-query'
import { adminListOrders, type ListAdminOrdersParams } from '@/shared/api/client'

export function useAdminOrdersQuery(params: ListAdminOrdersParams,
  /**
   * Releitura automática, em ms. Ausente = lê uma vez.
   *
   * Parâmetro em vez de valor fixo porque quem sabe se a tela fica aberta no balcão é a tela, não a
   * consulta: a de pedidos precisa envelhecer sozinha, outras não.
   */
  refetchIntervalMs?: number,
) {
  return useQuery({
    queryKey: ['admin-orders', params],
    queryFn: () => adminListOrders(params),
    ...(refetchIntervalMs ? { refetchInterval: refetchIntervalMs } : {}),
  })
}
