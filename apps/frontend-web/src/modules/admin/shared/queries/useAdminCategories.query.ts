import { useQuery } from '@tanstack/react-query'
import { adminListCategories } from '@/shared/api/client'

export function useAdminCategoriesQuery() {
  return useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminListCategories(),
  })
}
