import React from 'react'
import { useRequireAdmin } from '@/modules/admin/shared/useAdminAuth.hook'
import { useUrlQueryState } from '@/shared/hooks/useUrlQueryState.hook'
import { useAdminDemandsQuery } from '@/modules/admin/shared/queries/useAdminDemands.query'
import { useAdminProductsQuery } from '@/modules/admin/shared/queries/useAdminProducts.query'
import { useAddProductAliasMutation } from '@/modules/admin/shared/mutations/useAddProductAlias.mutation'
import type { Product, UnmatchedDemand } from '@/shared/api/api.types'

const DEMANDS_LIMIT = 30
const DEFAULT_WINDOW_DAYS = 90

/**
 * Catálogo carregado de uma vez para a busca de produto acontecer na tela.
 *
 * A rota de produtos não tem busca por texto, e o lojista precisa achar "Mamão" digitando "mam" sem
 * esperar requisição a cada letra. Cem cobre o catálogo de uma loja de bairro; acima disso a busca
 * passa a mentir por omissão, e aí o certo é a API ganhar busca em vez de a tela carregar mais.
 */
const PRODUCTS_FOR_PICKER = 100

/** Quanto tempo a demanda olha para trás. Rótulos curtos porque viram botões. */
export const DEMAND_WINDOWS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
] as const

export function useAdminDemandsPage() {
  const token = useRequireAdmin()
  const { searchParams, setQueryParams } = useUrlQueryState()

  const windowDays = Number(searchParams.get('windowDays') ?? String(DEFAULT_WINDOW_DAYS))

  const { data, isLoading } = useAdminDemandsQuery(token, { limit: DEMANDS_LIMIT, windowDays })
  const { data: productsData } = useAdminProductsQuery(token, { page: 1, perPage: PRODUCTS_FOR_PICKER })
  const addAliasMutation = useAddProductAliasMutation(token)

  // Qual linha está com o seletor de produto aberto. Uma por vez: duas buscas abertas na mesma tela
  // fazem o lojista perder de vista a qual termo está respondendo.
  const [aliasTargetTerm, setAliasTargetTerm] = React.useState<string | undefined>(undefined)
  const [productSearch, setProductSearch] = React.useState('')
  const [feedback, setFeedback] = React.useState<string | undefined>(undefined)

  const products = productsData?.data ?? []

  const matchingProducts = React.useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    if (query.length === 0) return []
    return products
      .filter((product) => `${product.name} ${product.brand ?? ''}`.toLowerCase().includes(query))
      .slice(0, 8)
  }, [products, productSearch])

  function openAliasPicker(demand: UnmatchedDemand) {
    setAliasTargetTerm(demand.term)
    // Começa a busca com o que o cliente falou: na maioria dos casos o produto existe com nome parecido.
    setProductSearch(demand.lastRawTerm)
    setFeedback(undefined)
  }

  function closeAliasPicker() {
    setAliasTargetTerm(undefined)
    setProductSearch('')
  }

  async function addAlias(product: Product, alias: string) {
    try {
      await addAliasMutation.mutateAsync({ product, alias })
      setFeedback(`"${alias}" agora aponta para ${product.name}. O próximo cliente que falar assim já encontra.`)
      closeAliasPicker()
    } catch {
      setFeedback('Não foi possível salvar o apelido. Tente de novo.')
    }
  }

  function setWindowDays(days: number) {
    setQueryParams({ windowDays: String(days) })
  }

  return {
    token,
    demands: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    windowDays,
    setWindowDays,
    aliasTargetTerm,
    openAliasPicker,
    closeAliasPicker,
    productSearch,
    setProductSearch,
    matchingProducts,
    addAlias,
    isSavingAlias: addAliasMutation.isPending,
    feedback,
  }
}
