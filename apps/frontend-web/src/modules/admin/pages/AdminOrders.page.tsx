import React from 'react'
import { useAdminOrdersPage } from '@/modules/admin/hooks/useAdminOrdersPage.hook'
import { Button, Input } from '@/components/ui'
import { FilterRow } from '@/modules/admin/components/FilterRow'
import { OrdersTableView } from '@/modules/admin/components/OrdersTableView'
import { DELIVERY_LABELS, PAYMENT_LABELS } from '@/modules/admin/shared/orderLabels'
import { ORDER_STATUS_LABELS, orderStatusLabel } from '@/modules/admin/shared/orderStatusStyle'
import { AppliedFilterPills, type AppliedFilter } from '@/modules/admin/components/AppliedFilterPills'

/** Nome da coluna na pill de ordenação: "Ordem: Recebido ↑" lê melhor que "Ordem: createdAt ↑". */
const SORT_LABELS: Record<string, string> = {
  createdAt: 'Recebido',
  totalInCents: 'Total',
  status: 'Situação',
}


export function AdminOrdersPage() {
  const {
    token,
    orders,
    pagination,
    isLoading,
    now,
    page,
    perPage,
    setPage,
    statusFilter,
    deliveryFilter,
    paymentFilter,
    search,
    setSearch,
    toggleFilterValue,
    removeFilterValue,
    clearSort,
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
    isBulkRunning,
  } = useAdminOrdersPage()

  // Campo local para digitar sem refazer a consulta a cada letra; a URL recebe no enter ou ao sair.
  const [searchDraft, setSearchDraft] = React.useState(search)
  React.useEffect(() => setSearchDraft(search), [search])

  if (!token) return null

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / perPage)) : 1

  const appliedFilters: AppliedFilter[] = [
    ...statusFilter.map((value) => ({
      key: `status:${value}`,
      label: `Situação: ${orderStatusLabel(value)}`,
      onRemove: () => removeFilterValue('status', value),
    })),
    ...deliveryFilter.map((value) => ({
      key: `delivery:${value}`,
      label: `Entrega: ${DELIVERY_LABELS[value] ?? value}`,
      onRemove: () => removeFilterValue('deliveryType', value),
    })),
    ...paymentFilter.map((value) => ({
      key: `payment:${value}`,
      label: `Pagamento: ${PAYMENT_LABELS[value] ?? value}`,
      onRemove: () => removeFilterValue('paymentMethod', value),
    })),
    ...(search.trim().length > 0
      ? [{ key: 'search', label: `Busca: ${search.trim()}`, onRemove: () => setSearch('') }]
      : []),
    ...(sortBy !== 'createdAt' || sortDirection !== 'asc'
      ? [
          {
            key: 'sort',
            label: `Ordem: ${SORT_LABELS[sortBy] ?? sortBy} ${sortDirection === 'asc' ? '↑' : '↓'}`,
            onRemove: clearSort,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground">
          Do mais antigo para o mais novo — quem pediu primeiro é quem está esperando há mais tempo.
        </p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setSearch(searchDraft)
        }}
      >
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onBlur={() => setSearch(searchDraft)}
          placeholder="Buscar por nome, telefone ou código…"
          className="max-w-xs"
          aria-label="Buscar pedidos"
        />
        <Button type="submit" variant="secondary" size="sm">
          Buscar
        </Button>
      </form>

      <div className="space-y-2">
        <FilterRow
          label="Situação"
          options={Object.entries(ORDER_STATUS_LABELS)}
          selected={statusFilter}
          onToggle={(value) => toggleFilterValue('status', value)}
        />
        <FilterRow
          label="Entrega"
          options={Object.entries(DELIVERY_LABELS)}
          selected={deliveryFilter}
          onToggle={(value) => toggleFilterValue('deliveryType', value)}
        />
        <FilterRow
          label="Pagamento"
          options={Object.entries(PAYMENT_LABELS)}
          selected={paymentFilter}
          onToggle={(value) => toggleFilterValue('paymentMethod', value)}
        />

        {/*
          Pills do que está filtrando agora, com a busca incluída.
          Os botões acima mostram o próprio estado, mas busca e ordenação não têm botão: quem digitava no
          campo via a lista encurtar sem nada dizendo por quê.
        */}
        <AppliedFilterPills filters={appliedFilters} onClearAll={clearFilters} />
      </div>

      {/* Barra de lote só existe quando há seleção — espaço ocupado prometendo ação é ruído. */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
          <p className="text-sm">
            {selectedIds.length} pedido{selectedIds.length > 1 ? 's' : ''} selecionado
            {selectedIds.length > 1 ? 's' : ''}
          </p>
          <Button size="sm" disabled={isBulkRunning} onClick={() => void confirmSelected()}>
            {isBulkRunning ? 'Confirmando…' : 'Confirmar selecionados'}
          </Button>
        </div>
      )}

      <OrdersTableView
        orders={orders}
        isLoading={isLoading}
        now={now}
        hasFiltersApplied={hasFiltersApplied}
        selectedIds={selectedIds}
        isAllOnPageSelected={isAllOnPageSelected}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
        onToggleSelected={toggleSelected}
        onToggleSelectAllOnPage={toggleSelectAllOnPage}
        onOpenOrder={openOrder}
        onUpdateStatus={updateStatus}
      />

      {pagination && pagination.total > perPage && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {pagination.total} pedido{pagination.total > 1 ? 's' : ''} · página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
