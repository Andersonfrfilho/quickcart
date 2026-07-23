import { useRequireAdmin } from '@/modules/admin/shared/useAdminAuth.hook'
import { useUrlQueryState } from '@/shared/hooks/useUrlQueryState.hook'
import { useAdminOrdersQuery } from '@/modules/admin/shared/queries/useAdminOrders.query'
import { useUpdateOrderStatusMutation } from '@/modules/admin/shared/mutations/useUpdateOrderStatus.mutation'
import type { OrderSortableField, SortDirection } from '@/shared/api/api.types'

const ORDERS_PER_PAGE = 15
const DEFAULT_SORT_BY: OrderSortableField = 'createdAt'
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc'

export function useAdminOrdersPage() {
  const token = useRequireAdmin()
  const { searchParams, setQueryParams } = useUrlQueryState()

  const page = Number(searchParams.get('page') ?? '1')
  const statusFilter = searchParams.get('status')?.split(',').filter(Boolean) ?? []
  const sortBy = (searchParams.get('sortBy') as OrderSortableField | null) ?? DEFAULT_SORT_BY
  const sortDirection = (searchParams.get('sortDirection') as SortDirection | null) ?? DEFAULT_SORT_DIRECTION

  const { data, isLoading } = useAdminOrdersQuery(token, {
    page,
    perPage: ORDERS_PER_PAGE,
    status: statusFilter,
    sortBy,
    sortDirection,
  })

  const updateStatusMutation = useUpdateOrderStatusMutation(token)

  function setPage(nextPage: number) {
    setQueryParams({ page: String(nextPage) })
  }

  function toggleStatusFilter(status: string) {
    const next = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status]
    setQueryParams({ status: next.length > 0 ? next.join(',') : undefined, page: '1' })
  }

  function clearStatusFilter() {
    setQueryParams({ status: undefined, page: '1' })
  }

  function handleSort(field: OrderSortableField) {
    if (sortBy === field) {
      setQueryParams({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' })
    } else {
      setQueryParams({ sortBy: field, sortDirection: 'asc' })
    }
  }

  function updateStatus(id: string, status: string) {
    updateStatusMutation.mutate({ id, status })
  }

  return {
    token,
    orders: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    page,
    perPage: ORDERS_PER_PAGE,
    setPage,
    statusFilter,
    toggleStatusFilter,
    clearStatusFilter,
    sortBy,
    sortDirection,
    handleSort,
    updateStatus,
  }
}
