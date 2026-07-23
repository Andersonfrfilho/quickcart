import { useQuery } from '@tanstack/react-query'
import { adminListCategories } from '@/shared/api/client'

export function useAdminCategoriesQuery(token: string | null) {
  return useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminListCategories(token as string),
    enabled: !!token,
  })
}
