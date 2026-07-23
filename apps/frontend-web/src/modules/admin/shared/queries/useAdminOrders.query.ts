import { useQuery } from '@tanstack/react-query'
import { adminListOrders, type ListAdminOrdersParams } from '@/shared/api/client'

export function useAdminOrdersQuery(token: string | null, params: ListAdminOrdersParams) {
  return useQuery({
    queryKey: ['admin-orders', params],
    queryFn: () => adminListOrders(token as string, params),
    enabled: !!token,
  })
}
