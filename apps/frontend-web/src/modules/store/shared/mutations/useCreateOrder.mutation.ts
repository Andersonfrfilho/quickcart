import { useMutation } from '@tanstack/react-query'
import { createOrder, type CreateOrderInput } from '@/shared/api/client'

export function useCreateOrderMutation() {
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateOrderInput; idempotencyKey: string }) =>
      createOrder(body, idempotencyKey),
  })
}
