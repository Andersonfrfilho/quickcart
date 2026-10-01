import { useQuery } from '@tanstack/react-query'
import { adminListDeliveryFeeTiers } from '@/shared/api/client'

export const ADMIN_DELIVERY_FEE_TIERS_QUERY_KEY = ['admin-delivery-fee-tiers']

export function useAdminDeliveryFeeTiersQuery() {
  return useQuery({
    queryKey: ADMIN_DELIVERY_FEE_TIERS_QUERY_KEY,
    queryFn: () => adminListDeliveryFeeTiers(),
  })
}
