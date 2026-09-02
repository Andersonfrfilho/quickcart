import React from 'react'
import { useRequireStaff } from '@/modules/auth/shared/useSession.hook'
import { ADMIN_AND_ATTENDANT } from '@/modules/auth/shared/roles.constant'
import { useUrlQueryState } from '@/shared/hooks/useUrlQueryState.hook'
import { useAdminDemandsQuery } from '@/modules/admin/shared/queries/useAdminDemands.query'
import { useAdminProductsQuery } from '@/modules/admin/shared/queries/useAdminProducts.query'
import { useAddProductAliasMutation } from '@/modules/admin/shared/mutations/useAddProductAlias.mutation'
import type { Product, SortDirection, UnmatchedDemand, UnmatchedDemandSortableField } from '@/shared/api/api.types'

const DEMANDS_LIMIT = 30
export const DEFAULT_WINDOW_DAYS = 90

/**
 * Catálogo carregado de uma vez para a busca de produto acontecer na tela.
 *
 * A rota de produtos não tem busca por texto, e o lojista precisa achar "Mamão" digitando "mam" sem
 * esperar requisição a cada letra. Cem cobre o catálogo de uma loja de bairro; acima disso a busca
 * passa a mentir por omissão, e aí o certo é a API ganhar busca em vez de a tela carregar mais.
 */
const PRODUCTS_FOR_PICKER = 100

/**
 * Clientes distintos primeiro, do maior para o menor.
 *
 * É o número que decide passar a vender: dez pedidos de uma pessoa são um gosto pessoal, dez pessoas
 * pedindo uma vez são prateleira vazia. Qualquer outra ordem de abertura enterraria a linha que mais
 * importa no meio da lista.
 */
const DEFAULT_SORT_BY: UnmatchedDemandSortableField = 'customerCount'
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc'

/** Quanto tempo a demanda olha para trás. Rótulos curtos porque viram botões. */
export const DEMAND_WINDOWS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
] as const

function parseCsvParam(value: string | null): string[] {
  return value?.split(',').filter(Boolean) ?? []
}

export function useAdminDemandsPage() {
  const { isReady } = useRequireStaff(ADMIN_AND_ATTENDANT)
  const { searchParams, setQueryParams } = useUrlQueryState()

  const windowDays = Number(searchParams.get('windowDays') ?? String(DEFAULT_WINDOW_DAYS))
  const sourceFilter = parseCsvParam(searchParams.get('source'))
  const search = searchParams.get('search') ?? ''
  const sortBy = (searchParams.get('sortBy') as UnmatchedDemandSortableField | null) ?? DEFAULT_SORT_BY
  const sortDirection = (searchParams.get('sortDirection') as SortDirection | null) ?? DEFAULT_SORT_DIRECTION

  const { data, isLoading } = useAdminDemandsQuery({
    limit: DEMANDS_LIMIT,
    windowDays,
    source: sourceFilter,
    search,
    sortBy,
    sortDirection,
  })
  const { data: productsData } = useAdminProductsQuery({ page: 1, perPage: PRODUCTS_FOR_PICKER })
  const addAliasMutation = useAddProductAliasMutation()

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

  /**
   * A janela conta como filtro aplicado.
   *
   * Ela recorta o mesmo relatório e é a causa mais comum de "sumiu uma linha" — deixá-la fora do
   * "limpar" faria o lojista limpar tudo e continuar olhando 30 dias sem entender por quê.
   */
  const hasFiltersApplied =
    sourceFilter.length > 0 ||
    search.trim().length > 0 ||
    sortBy !== DEFAULT_SORT_BY ||
    sortDirection !== DEFAULT_SORT_DIRECTION ||
    windowDays !== DEFAULT_WINDOW_DAYS

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

  function toggleSourceFilter(value: string) {
    const next = sourceFilter.includes(value)
      ? sourceFilter.filter((entry) => entry !== value)
      : [...sourceFilter, value]
    setQueryParams({ source: next.length > 0 ? next.join(',') : undefined })
  }

  function setSearch(nextSearch: string) {
    setQueryParams({ search: nextSearch.trim().length > 0 ? nextSearch : undefined })
  }

  /**
   * Tirar SÓ a ordenação, e só a janela.
   *
   * Antes existia apenas "limpar tudo": para voltar à ordem por clientes depois de espiar por data, o
   * lojista perdia origem, busca e período junto — e num relatório que se lê ajustando um critério por
   * vez, isso apaga a comparação que ele estava fazendo.
   */
  function clearSort() {
    setQueryParams({ sortBy: undefined, sortDirection: undefined })
  }

  function resetWindowDays() {
    setQueryParams({ windowDays: undefined })
  }

  function clearFilters() {
    setQueryParams({
      source: undefined,
      search: undefined,
      sortBy: undefined,
      sortDirection: undefined,
      windowDays: undefined,
    })
  }

  /**
   * Terceiro clique volta ao padrão, em vez de alternar asc/desc para sempre.
   *
   * Sem o estado neutro não há como voltar à ordem por clientes depois de espiar por data — e é a ordem
   * por clientes que responde à pergunta que trouxe o lojista até aqui.
   */
  function handleSort(field: UnmatchedDemandSortableField) {
    if (sortBy !== field) {
      setQueryParams({ sortBy: field, sortDirection: 'asc' })
      return
    }
    if (sortDirection === 'asc') {
      setQueryParams({ sortDirection: 'desc' })
      return
    }
    setQueryParams({ sortBy: undefined, sortDirection: undefined })
  }

  return {
    isReady,
    demands: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    windowDays,
    setWindowDays,
    sourceFilter,
    toggleSourceFilter,
    search,
    setSearch,
    sortBy,
    sortDirection,
    handleSort,
    clearSort,
    resetWindowDays,
    hasFiltersApplied,
    clearFilters,
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
