import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAdjustStock } from '@/shared/api/client'

export function useAdjustStockMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      adminAdjustStock(id, { delta }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  })
}
