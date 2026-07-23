import { useQuery } from '@tanstack/react-query'
import { getProducts, type ListProductsParams } from '@/shared/api/client'

export function useProductsQuery(params: ListProductsParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => getProducts(params),
    enabled: !!params.categoryId,
  })
}
