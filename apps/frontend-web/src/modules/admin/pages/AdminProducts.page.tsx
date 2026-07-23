import React from 'react'
import { useAdminProductsPage } from '@/modules/admin/hooks/useAdminProductsPage.hook'
import {
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortableTableHead,
} from '@/components/ui'
import type { ProductSortableField } from '@/shared/api/api.types'

export function AdminProductsPage() {
  const {
    token,
    products,
    pagination,
    isLoading,
    categories,
    categoryFilter,
    toggleCategoryFilter,
    clearCategoryFilter,
    page,
    perPage,
    setPage,
    sortBy,
    sortDirection,
    handleSort,
    editingId,
    stockDelta,
    setStockDelta,
    startEditingStock,
    confirmStockAdjustment,
  } = useAdminProductsPage()

  if (!token) return null

  function sortHeaderProps(field: ProductSortableField) {
    return { active: sortBy === field, direction: sortDirection, onSort: () => handleSort(field) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Gerencie o catálogo de produtos</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={categoryFilter.includes(cat.id) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleCategoryFilter(cat.id)}
          >
            {cat.emoji} {cat.name}
          </Button>
        ))}
        {categoryFilter.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCategoryFilter}>
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead {...sortHeaderProps('name')}>Nome</SortableTableHead>
              <TableHead>Marca</TableHead>
              <SortableTableHead {...sortHeaderProps('priceInCents')}>Preço</SortableTableHead>
              <SortableTableHead {...sortHeaderProps('stockQuantity')}>Estoque</SortableTableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.brand ?? '—'}</TableCell>
                <TableCell>
                  {(p.priceInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-20 h-8"
                        placeholder="±"
                        value={stockDelta}
                        onChange={(e) => setStockDelta(e.target.value)}
                      />
                      <Button size="sm" onClick={() => confirmStockAdjustment(p.id)}>
                        OK
                      </Button>
                    </div>
                  ) : (
                    <Badge variant={p.stockQuantity > 0 ? 'default' : 'destructive'}>
                      {p.stockQuantity}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => startEditingStock(p.id)}>
                    {editingId === p.id ? 'Cancelar' : 'Ajustar estoque'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {Math.ceil(pagination.total / perPage)} ({pagination.total} produtos)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * perPage >= pagination.total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
