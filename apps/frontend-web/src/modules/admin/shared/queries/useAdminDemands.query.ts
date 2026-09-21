import { useQuery } from '@tanstack/react-query'
import { adminListUnmatchedDemands, type ListUnmatchedDemandsParams } from '@/shared/api/client'

export function useAdminDemandsQuery(params: ListUnmatchedDemandsParams) {
  return useQuery({
    queryKey: ['admin-demands', params],
    queryFn: () => adminListUnmatchedDemands(params),
  })
}
