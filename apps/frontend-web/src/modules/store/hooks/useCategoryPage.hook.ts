import { useState } from 'react'
import { useRouter } from '@/app/router'
import { useCartStore } from '@/modules/store/shared/cartStore'
import { useCategoriesQuery } from '@/modules/store/shared/queries/useCategories.query'
import { useProductsQuery } from '@/modules/store/shared/queries/useProducts.query'
import type { Product } from '@/shared/api/api.types'

const PRODUCTS_PER_PAGE = 20

export function useCategoryPage() {
  const { navigate, searchParams } = useRouter()
  const categoryId = searchParams.get('categoryId') ?? ''
  const [page, setPage] = useState(1)

  const { data: categoriesData } = useCategoriesQuery()
  const { data: productsData } = useProductsQuery({
    categoryId,
    page,
    perPage: PRODUCTS_PER_PAGE,
    sortBy: 'name',
    sortDirection: 'asc',
  })

  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const cartItems = useCartStore((s) => s.items)
  const categories = categoriesData?.data ?? []
  const category = categories.find((c) => c.id === categoryId)
  const products = productsData?.data ?? []
  const pagination = productsData?.pagination

  function handleSelectCategory(nextCategoryId: string) {
    setPage(1)
    navigate(`/category?categoryId=${nextCategoryId}`)
  }

  function handleAddToCart(product: Product) {
    addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      unitSize: product.unitSize,
      priceInCents: product.priceInCents,
      imageUrl: product.imageUrl,
    })
  }

  function getCartQuantity(productId: string) {
    return cartItems.find((item) => item.productId === productId)?.quantity ?? 0
  }

  return {
    categories,
    category,
    products,
    pagination,
    page,
    setPage,
    perPage: PRODUCTS_PER_PAGE,
    categoryId,
    handleSelectCategory,
    handleAddToCart,
    updateQuantity,
    getCartQuantity,
  }
}
