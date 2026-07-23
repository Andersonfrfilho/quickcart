import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminUpdateOrderStatus } from '@/shared/api/client'

export function useUpdateOrderStatusMutation(token: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminUpdateOrderStatus(token as string, id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
  })
}
