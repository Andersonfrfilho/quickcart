import React from 'react'
import { useHomePage } from '@/modules/store/hooks/useHomePage.hook'
import { Input, Card } from '@/components/ui'

export function HomePage() {
  const {
    search,
    setSearch,
    debouncedSearch,
    categories,
    searchResults,
    handleSelectCategory,
    handleSelectSearchResult,
  } = useHomePage()

  return (
    <div className="space-y-8">
      <div className="relative">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produtos..."
          className="text-lg h-12"
        />
        {searchResults.length > 0 && debouncedSearch.length >= 2 && (
          <Card className="absolute z-10 w-full mt-1 max-h-80 overflow-auto">
            <ul className="divide-y">
              {searchResults.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectSearchResult(product)}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{product.name}</span>
                        {product.brand && <span className="text-muted-foreground text-sm ml-2">{product.brand}</span>}
                      </div>
                      <span className="text-primary font-medium">
                        {(product.priceInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Categorias</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="cursor-pointer hover:shadow-md transition-shadow p-4 text-center"
              onClick={() => handleSelectCategory(category.id)}
            >
              <span className="text-3xl block mb-2">{category.emoji ?? '🛒'}</span>
              <span className="text-sm font-medium">{category.name}</span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
