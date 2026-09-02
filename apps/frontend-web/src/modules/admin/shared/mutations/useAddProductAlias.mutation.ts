import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminUpdateProduct } from '@/shared/api/client'
import type { Product } from '@/shared/api/api.types'

export type AddProductAliasParams = {
  readonly product: Product
  readonly alias: string
}

/**
 * Acrescenta um apelido ao produto, preservando os que já existem.
 *
 * A rota de atualização SUBSTITUI a lista de apelidos, então mandar só o novo apagaria os antigos sem
 * aviso — e apelido apagado quebra o casamento de fala que já funcionava, o que é pior que não ter
 * adicionado nada. Por isso a mutação recebe o produto inteiro, não só o id.
 */
export function useAddProductAliasMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ product, alias }: AddProductAliasParams) => {
      const normalized = alias.trim().toLowerCase()
      const current = product.aliases ?? []

      // Já existe: não manda requisição nenhuma, para não gerar histórico de update sem mudança.
      if (current.some((existing) => existing.toLowerCase() === normalized)) return product

      const result = await adminUpdateProduct(product.id, {
        aliases: [...current, normalized],
      })
      return result.data
    },
    onSuccess: () => {
      // O produto mudou; a lista aberta na tela precisa refletir o apelido novo.
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })
}
