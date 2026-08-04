import { useQuery } from '@tanstack/react-query'
import { adminListUnmatchedDemands, type ListUnmatchedDemandsParams } from '@/shared/api/client'

export function useAdminDemandsQuery(token: string | null, params: ListUnmatchedDemandsParams) {
  return useQuery({
    queryKey: ['admin-demands', params],
    queryFn: () => adminListUnmatchedDemands(token as string, params),
    enabled: !!token,
  })
}
