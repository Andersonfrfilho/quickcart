import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAdjustStock } from '@/shared/api/client'

export function useAdjustStockMutation(token: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      adminAdjustStock(token as string, id, { delta }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  })
}
