import React from 'react'
import { useRequireAdmin } from '@/modules/admin/shared/useAdminAuth.hook'
import { useUrlQueryState } from '@/shared/hooks/useUrlQueryState.hook'
import { useRouter } from '@/app/router'
import { useAdminOrdersQuery } from '@/modules/admin/shared/queries/useAdminOrders.query'
import { useUpdateOrderStatusMutation } from '@/modules/admin/shared/mutations/useUpdateOrderStatus.mutation'
import { ORDER_STATUS, type OrderSortableField, type SortDirection } from '@/shared/api/api.types'

const ORDERS_PER_PAGE = 15

/**
 * Mais antigos primeiro, por padrão.
 *
 * A fila de pedidos é fila: quem pediu antes espera mais, e uma lista que abre pelos recém-chegados
 * empurra para o fim da página exatamente o pedido que já está atrasado. Ordem decrescente serve para
 * auditar histórico, não para operar o balcão.
 */
const DEFAULT_SORT_BY: OrderSortableField = 'createdAt'
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc'

/**
 * Releitura periódica: a lista fica aberta no balcão e pedido novo tem de aparecer sem F5.
 *
 * É também o que faz o tempo de espera envelhecer na tela — sem isso "há 2 min" fica congelado
 * enquanto o pedido de verdade passa de trinta.
 */
const REFETCH_INTERVAL_MS = 20_000

/** Quanto tempo entre os ticks do relógio da tela. Meio minuto basta para "há N min" não mentir. */
const CLOCK_TICK_MS = 30_000

/** Ações em lote. Confirmar é a única transição que faz sentido para vários pedidos de uma vez. */
export const BULK_ACTION = { CONFIRM: ORDER_STATUS.CONFIRMED } as const

function parseCsvParam(value: string | null): string[] {
  return value?.split(',').filter(Boolean) ?? []
}

export function useAdminOrdersPage() {
  const token = useRequireAdmin()
  const { searchParams, setQueryParams } = useUrlQueryState()
  const { navigate } = useRouter()

  const page = Number(searchParams.get('page') ?? '1')
  const statusFilter = parseCsvParam(searchParams.get('status'))
  const deliveryFilter = parseCsvParam(searchParams.get('deliveryType'))
  const paymentFilter = parseCsvParam(searchParams.get('paymentMethod'))
  const search = searchParams.get('search') ?? ''
  const sortBy = (searchParams.get('sortBy') as OrderSortableField | null) ?? DEFAULT_SORT_BY
  const sortDirection = (searchParams.get('sortDirection') as SortDirection | null) ?? DEFAULT_SORT_DIRECTION

  const { data, isLoading } = useAdminOrdersQuery(
    token,
    {
      page,
      perPage: ORDERS_PER_PAGE,
      status: statusFilter,
      deliveryType: deliveryFilter,
      paymentMethod: paymentFilter,
      search,
      sortBy,
      sortDirection,
    },
    REFETCH_INTERVAL_MS,
  )

  const updateStatusMutation = useUpdateOrderStatusMutation(token)

  /**
   * Relógio local, para espera e urgência envelhecerem sem recarregar.
   *
   * Local e não global: só esta tela mostra tempo de espera, e um tick no app inteiro redesenharia
   * telas que não têm nada a ver com isso.
   */
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => window.clearInterval(interval)
  }, [])

  const [selectedIds, setSelectedIds] = React.useState<readonly string[]>([])

  const orders = data?.data ?? []

  /** Só mostra "limpar" quando há o que limpar — botão morto ensina a ignorar a barra de filtros. */
  const hasFiltersApplied =
    statusFilter.length > 0 ||
    deliveryFilter.length > 0 ||
    paymentFilter.length > 0 ||
    search.trim().length > 0 ||
    sortBy !== DEFAULT_SORT_BY ||
    sortDirection !== DEFAULT_SORT_DIRECTION

  function setPage(nextPage: number) {
    setQueryParams({ page: String(nextPage) })
  }

  /** Qualquer mudança de filtro volta para a página 1: filtrar estando na página 3 mostra tela vazia. */
  function toggleFilterValue(key: 'status' | 'deliveryType' | 'paymentMethod', value: string) {
    const current = parseCsvParam(searchParams.get(key))
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
    setQueryParams({ [key]: next.length > 0 ? next.join(',') : undefined, page: '1' })
  }

  function setSearch(nextSearch: string) {
    setQueryParams({ search: nextSearch.trim().length > 0 ? nextSearch : undefined, page: '1' })
  }

  function clearFilters() {
    setQueryParams({
      status: undefined,
      deliveryType: undefined,
      paymentMethod: undefined,
      search: undefined,
      sortBy: undefined,
      sortDirection: undefined,
      page: '1',
    })
  }

  /**
   * Terceiro clique volta ao padrão, em vez de alternar asc/desc para sempre.
   *
   * Sem o estado neutro não há como voltar à ordem da fila depois de espiar por valor — e voltar à fila
   * é o que o operador quer na maioria das vezes.
   */
  function handleSort(field: OrderSortableField) {
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

  /**
   * Detalhe é TELA, não linha expandida.
   *
   * Compra de supermercado tem lista longa, e abrir cinquenta itens dentro de uma linha empurra o resto
   * da fila para fora do monitor — quem separa perde a lista de pedidos justamente quando precisa dela.
   * Tela própria ainda ganha URL: dá para mandar o link do pedido para quem está no depósito.
   */
  function openOrder(orderId: string) {
    navigate(`/admin/orders/${orderId}`)
  }

  function toggleSelected(orderId: string) {
    setSelectedIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    )
  }

  const pageIds = orders.map((order) => order.id)
  const isAllOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))

  /** Marca/desmarca apenas o que está NA PÁGINA: agir sobre o que não está na tela é armadilha. */
  function toggleSelectAllOnPage() {
    setSelectedIds(isAllOnPageSelected ? [] : pageIds)
  }

  function updateStatus(id: string, status: string) {
    updateStatusMutation.mutate({ id, status })
  }

  async function confirmSelected() {
    // Sequencial de propósito: são transições no mesmo recurso, e disparar em paralelo deixaria a lista
    // piscando em ordem imprevisível quando uma falhasse.
    for (const id of selectedIds) {
      await updateStatusMutation.mutateAsync({ id, status: BULK_ACTION.CONFIRM })
    }
    setSelectedIds([])
  }

  return {
    token,
    orders,
    pagination: data?.pagination,
    isLoading,
    now,
    page,
    perPage: ORDERS_PER_PAGE,
    setPage,
    statusFilter,
    deliveryFilter,
    paymentFilter,
    search,
    setSearch,
    toggleFilterValue,
    hasFiltersApplied,
    clearFilters,
    sortBy,
    sortDirection,
    handleSort,
    updateStatus,
    openOrder,
    selectedIds,
    isAllOnPageSelected,
    toggleSelected,
    toggleSelectAllOnPage,
    confirmSelected,
    isBulkRunning: updateStatusMutation.isPending,
  }
}
