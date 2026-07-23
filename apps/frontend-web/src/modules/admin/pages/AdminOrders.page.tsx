import React from 'react'
import { useAdminOrdersPage } from '@/modules/admin/hooks/useAdminOrdersPage.hook'
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortableTableHead,
} from '@/components/ui'
import type { OrderSortableField } from '@/shared/api/api.types'

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Aguardando',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending_confirmation: 'outline',
  confirmed: 'default',
  preparing: 'secondary',
  out_for_delivery: 'secondary',
  ready_for_pickup: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
}

const NEXT_STATUS: Record<string, string[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'ready_for_pickup', 'cancelled'],
  out_for_delivery: ['completed'],
  ready_for_pickup: ['completed'],
}

export function AdminOrdersPage() {
  const {
    token,
    orders,
    pagination,
    isLoading,
    page,
    perPage,
    setPage,
    statusFilter,
    toggleStatusFilter,
    clearStatusFilter,
    sortBy,
    sortDirection,
    handleSort,
    updateStatus,
  } = useAdminOrdersPage()

  if (!token) return null

  function sortHeaderProps(field: OrderSortableField) {
    return { active: sortBy === field, direction: sortDirection, onSort: () => handleSort(field) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Gerencie os pedidos dos clientes</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <Button
            key={value}
            variant={statusFilter.includes(value) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
        {statusFilter.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearStatusFilter}>
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <SortableTableHead {...sortHeaderProps('totalInCents')}>Total</SortableTableHead>
              <SortableTableHead {...sortHeaderProps('status')}>Status</SortableTableHead>
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
            ) : orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono font-medium">{order.shortCode}</TableCell>
                <TableCell>{order.customerName ?? order.customerPhone}</TableCell>
                <TableCell className="font-medium">
                  {(order.totalInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[order.status] ?? 'outline'}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    {NEXT_STATUS[order.status]?.map((next) => (
                      <Button
                        key={next}
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(order.id, next)}
                      >
                        → {STATUS_LABELS[next]}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {Math.ceil(pagination.total / perPage)} ({pagination.total} pedidos)
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
