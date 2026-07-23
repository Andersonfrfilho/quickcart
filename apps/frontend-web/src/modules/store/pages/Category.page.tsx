import React from 'react'
import { useCategoryPage } from '@/modules/store/hooks/useCategoryPage.hook'
import { Card, Button } from '@/components/ui'

export function CategoryPage() {
  const {
    categories,
    category,
    products,
    pagination,
    page,
    setPage,
    perPage,
    categoryId,
    handleSelectCategory,
    handleAddToCart,
  } = useCategoryPage()

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={cat.id === categoryId ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSelectCategory(cat.id)}
          >
            {cat.emoji} {cat.name}
          </Button>
        ))}
      </div>

      {category && <h2 className="text-xl font-semibold">{category.name}</h2>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="p-4">
            <h3 className="font-medium text-sm mb-1">{product.name}</h3>
            {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
            {product.unitSize && <p className="text-xs text-muted-foreground">{product.unitSize}</p>}
            <div className="flex items-center justify-between mt-3">
              <span className="font-semibold text-primary">
                {(product.priceInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <Button size="sm" onClick={() => handleAddToCart(product)}>
                +
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {pagination && pagination.total > perPage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {page}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * perPage >= pagination.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
