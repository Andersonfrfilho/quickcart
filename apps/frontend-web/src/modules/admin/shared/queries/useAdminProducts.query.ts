import { useQuery } from '@tanstack/react-query'
import { adminListProducts, type ListAdminProductsParams } from '@/shared/api/client'

export function useAdminProductsQuery(params: ListAdminProductsParams) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: () => adminListProducts(params),
  })
}
