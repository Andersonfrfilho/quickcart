import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminReplaceDeliveryFeeTiers } from '@/shared/api/client'
import type { DeliveryFeeTier } from '@/shared/api/api.types'
import { ADMIN_DELIVERY_FEE_TIERS_QUERY_KEY } from '@/modules/admin/shared/queries/useAdminDeliveryFeeTiers.query'

export function useReplaceDeliveryFeeTiersMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (tiers: readonly DeliveryFeeTier[]) => adminReplaceDeliveryFeeTiers(tiers),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_DELIVERY_FEE_TIERS_QUERY_KEY }),
  })
}
