import { useState } from 'react'
import { useRequireStaff } from '@/modules/auth/shared/useSession.hook'
import { ADMIN_ONLY } from '@/modules/auth/shared/roles.constant'
import { useUrlQueryState } from '@/shared/hooks/useUrlQueryState.hook'
import { useAdminProductsQuery } from '@/modules/admin/shared/queries/useAdminProducts.query'
import { useAdminCategoriesQuery } from '@/modules/admin/shared/queries/useAdminCategories.query'
import { useAdjustStockMutation } from '@/modules/admin/shared/mutations/useAdjustStock.mutation'
import type { ProductSortableField, SortDirection } from '@/shared/api/api.types'

const PRODUCTS_PER_PAGE = 15
const DEFAULT_SORT_BY: ProductSortableField = 'name'
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc'

export function useAdminProductsPage() {
  const { isReady } = useRequireStaff(ADMIN_ONLY)
  const { searchParams, setQueryParams } = useUrlQueryState()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockDelta, setStockDelta] = useState('')

  const page = Number(searchParams.get('page') ?? '1')
  const categoryFilter = searchParams.get('categoryId')?.split(',').filter(Boolean) ?? []
  const sortBy = (searchParams.get('sortBy') as ProductSortableField | null) ?? DEFAULT_SORT_BY
  const sortDirection = (searchParams.get('sortDirection') as SortDirection | null) ?? DEFAULT_SORT_DIRECTION

  const { data, isLoading } = useAdminProductsQuery({
    page,
    perPage: PRODUCTS_PER_PAGE,
    categoryId: categoryFilter,
    sortBy,
    sortDirection,
  })
  const { data: categoriesData } = useAdminCategoriesQuery()
  const adjustStockMutation = useAdjustStockMutation()

  function setPage(nextPage: number) {
    setQueryParams({ page: String(nextPage) })
  }

  function toggleCategoryFilter(categoryId: string) {
    const next = categoryFilter.includes(categoryId)
      ? categoryFilter.filter((id) => id !== categoryId)
      : [...categoryFilter, categoryId]
    setQueryParams({ categoryId: next.length > 0 ? next.join(',') : undefined, page: '1' })
  }

  function clearCategoryFilter() {
    setQueryParams({ categoryId: undefined, page: '1' })
  }

  function handleSort(field: ProductSortableField) {
    if (sortBy === field) {
      setQueryParams({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' })
    } else {
      setQueryParams({ sortBy: field, sortDirection: 'asc' })
    }
  }

  function startEditingStock(productId: string) {
    setEditingId((current) => (current === productId ? null : productId))
    setStockDelta('')
  }

  function confirmStockAdjustment(productId: string) {
    const delta = parseInt(stockDelta, 10)
    if (Number.isNaN(delta)) return
    adjustStockMutation.mutate({ id: productId, delta })
    setEditingId(null)
    setStockDelta('')
  }

  return {
    isReady,
    products: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    categories: categoriesData?.data ?? [],
    categoryFilter,
    toggleCategoryFilter,
    clearCategoryFilter,
    page,
    perPage: PRODUCTS_PER_PAGE,
    setPage,
    sortBy,
    sortDirection,
    handleSort,
    editingId,
    stockDelta,
    setStockDelta,
    startEditingStock,
    confirmStockAdjustment,
  }
}
