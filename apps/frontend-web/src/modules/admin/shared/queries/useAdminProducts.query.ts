import { useQuery } from '@tanstack/react-query'
import { adminListProducts, type ListAdminProductsParams } from '@/shared/api/client'

export function useAdminProductsQuery(token: string | null, params: ListAdminProductsParams) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: () => adminListProducts(token as string, params),
    enabled: !!token,
  })
}
