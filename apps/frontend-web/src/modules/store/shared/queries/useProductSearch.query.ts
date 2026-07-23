import { useQuery } from '@tanstack/react-query'
import { searchProducts } from '@/shared/api/client'

const MIN_QUERY_LENGTH = 2

export function useProductSearchQuery(query: string) {
  return useQuery({
    queryKey: ['product-search', query],
    queryFn: () => searchProducts(query),
    enabled: query.length >= MIN_QUERY_LENGTH,
  })
}
