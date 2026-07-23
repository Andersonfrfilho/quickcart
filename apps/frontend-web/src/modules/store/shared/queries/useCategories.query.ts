import { useQuery } from '@tanstack/react-query'
import { getCategories } from '@/shared/api/client'

export function useCategoriesQuery() {
  return useQuery({ queryKey: ['categories'], queryFn: getCategories })
}
