import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminUpdateProduct } from '@/shared/api/client'
import type { Product } from '@/shared/api/api.types'

export type UpdateProductAisleParams = {
  readonly id: string
  /** Vazio apaga o corredor: mapear errado é pior que não mapear, e quem separa precisa poder desfazer. */
  readonly aisle: string
}

/**
 * Grava onde o produto fica na loja.
 *
 * Manda só o campo do corredor: a rota aceita atualização parcial, e enviar o produto inteiro faria a
 * tela de estoque disputar a escrita com quem estiver ajustando preço na mesma linha.
 */
export function useUpdateProductAisleMutation(token: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, aisle }: UpdateProductAisleParams): Promise<Product> => {
      const trimmed = aisle.trim()
      const result = await adminUpdateProduct(token as string, id, { aisle: trimmed.length > 0 ? trimmed : null })
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })
}
