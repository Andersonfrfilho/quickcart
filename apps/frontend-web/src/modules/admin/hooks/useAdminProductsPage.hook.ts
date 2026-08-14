import { useState } from 'react'
import { useRequireAdmin } from '@/modules/admin/shared/useAdminAuth.hook'
import { useUrlQueryState } from '@/shared/hooks/useUrlQueryState.hook'
import { useAdminProductsQuery } from '@/modules/admin/shared/queries/useAdminProducts.query'
import { useAdminCategoriesQuery } from '@/modules/admin/shared/queries/useAdminCategories.query'
import { useAdjustStockMutation } from '@/modules/admin/shared/mutations/useAdjustStock.mutation'
import { useUpdateProductAisleMutation } from '@/modules/admin/shared/mutations/useUpdateProductAisle.mutation'
import type { Product, ProductSortableField, SortDirection } from '@/shared/api/api.types'

const PRODUCTS_PER_PAGE = 15
const DEFAULT_SORT_BY: ProductSortableField = 'name'
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc'

export function useAdminProductsPage() {
  const token = useRequireAdmin()
  const { searchParams, setQueryParams } = useUrlQueryState()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockDelta, setStockDelta] = useState('')
  /**
   * Estado próprio, e não o mesmo `editingId` do estoque: são duas edições diferentes na mesma linha, e
   * compartilhar o id faria abrir o corredor fechar o ajuste de estoque pela metade.
   */
  const [editingAisleId, setEditingAisleId] = useState<string | null>(null)
  const [aisleDraft, setAisleDraft] = useState('')

  const page = Number(searchParams.get('page') ?? '1')
  const categoryFilter = searchParams.get('categoryId')?.split(',').filter(Boolean) ?? []
  const sortBy = (searchParams.get('sortBy') as ProductSortableField | null) ?? DEFAULT_SORT_BY
  const sortDirection = (searchParams.get('sortDirection') as SortDirection | null) ?? DEFAULT_SORT_DIRECTION

  const { data, isLoading } = useAdminProductsQuery(token, {
    page,
    perPage: PRODUCTS_PER_PAGE,
    categoryId: categoryFilter,
    sortBy,
    sortDirection,
  })
  const { data: categoriesData } = useAdminCategoriesQuery(token)
  const adjustStockMutation = useAdjustStockMutation(token)
  const updateAisleMutation = useUpdateProductAisleMutation(token)

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

  /** Abre já com o valor atual dentro: corrigir "Corredor 3" para "Corredor 4" é o gesto comum, não digitar do zero. */
  function startEditingAisle(product: Product) {
    setEditingAisleId((current) => (current === product.id ? null : product.id))
    setAisleDraft(product.aisle ?? '')
  }

  function cancelEditingAisle() {
    setEditingAisleId(null)
    setAisleDraft('')
  }

  function confirmAisle(product: Product) {
    // Nada mudou: não gasta requisição nem histórico de update — inclusive quando os dois lados são vazios.
    if (aisleDraft.trim() === (product.aisle ?? '')) {
      cancelEditingAisle()
      return
    }
    updateAisleMutation.mutate({ id: product.id, aisle: aisleDraft })
    cancelEditingAisle()
  }

  return {
    token,
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
    editingAisleId,
    aisleDraft,
    setAisleDraft,
    startEditingAisle,
    cancelEditingAisle,
    confirmAisle,
    isSavingAisle: updateAisleMutation.isPending,
  }
}
