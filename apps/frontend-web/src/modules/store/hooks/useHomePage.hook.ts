import { useState } from 'react'
import { useRouter } from '@/app/router'
import { useDebounce } from '@/shared/hooks/useDebounce.hook'
import { useCategoriesQuery } from '@/modules/store/shared/queries/useCategories.query'
import { useProductSearchQuery } from '@/modules/store/shared/queries/useProductSearch.query'
import type { Product } from '@/shared/api/api.types'

const SEARCH_DEBOUNCE_MS = 250

export function useHomePage() {
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS)

  const { data: categories } = useCategoriesQuery()
  const { data: searchResults } = useProductSearchQuery(debouncedSearch)

  function handleSelectCategory(categoryId: string) {
    navigate(`/category?categoryId=${categoryId}`)
  }

  function handleSelectSearchResult(product: Product) {
    navigate(`/category?categoryId=${product.categoryId}`)
  }

  return {
    search,
    setSearch,
    debouncedSearch,
    categories: categories?.data ?? [],
    searchResults: searchResults?.data ?? [],
    handleSelectCategory,
    handleSelectSearchResult,
  }
}
