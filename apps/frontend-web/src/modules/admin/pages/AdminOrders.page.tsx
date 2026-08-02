import React from 'react'
import { useAdminOrdersPage } from '@/modules/admin/hooks/useAdminOrdersPage.hook'
import {
  ORDER_URGENCY,
  formatReceivedAt,
  formatWaitingFor,
  resolveOrderUrgency,
  type OrderUrgency,
} from '@/modules/admin/shared/orderUrgency'
import {
  Button,
  Badge,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortableTableHead,
} from '@/components/ui'
import { formatPhone } from '@adatechnology/conversations-ui'
import { nextStatusesFor } from '@/modules/admin/shared/orderTransitions'
import type { OrderSortableField } from '@/shared/api/api.types'

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Aguardando',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  separated: 'Separado',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending_confirmation: 'outline',
  confirmed: 'default',
  preparing: 'secondary',
  separated: 'default',
  out_for_delivery: 'secondary',
  ready_for_pickup: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
}


const DELIVERY_LABELS: Record<string, string> = { delivery: '🚚 Entrega', pickup: '🏪 Retirada' }
const PAYMENT_LABELS: Record<string, string> = {
  pix: '💳 Pix',
  card_on_delivery: '💳 Cartão na entrega',
  cash: '💵 Dinheiro',
}

/** Só a linha que precisa chamar atenção carrega classe; as outras não ganham estilo à toa. */
const URGENCY_ROW_CLASS: Record<OrderUrgency, string> = {
  [ORDER_URGENCY.LATE]: 'order-row-late',
  [ORDER_URGENCY.ATTENTION]: 'order-row-attention',
  [ORDER_URGENCY.FRESH]: '',
  [ORDER_URGENCY.HANDLED]: '',
}

const COLUMN_COUNT = 8

function formatMoney(totalInCents: number): string {
  return (totalInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatFullDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('pt-BR')
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

  function sortHeaderProps(field: OrderSortableField) {
    return { active: sortBy === field, direction: sortDirection, onSort: () => handleSort(field) }
  }

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / perPage)) : 1

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
          options={Object.entries(STATUS_LABELS)}
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

        {/* Só quando há filtro ou ordenação aplicados: botão morto ensina a ignorar a barra inteira. */}
        {hasFiltersApplied && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar filtros e ordenação
          </Button>
        )}
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

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="table-zebra">
          <TableHeader>
            <TableRow>
              <TableHead>
                <input
                  type="checkbox"
                  checked={isAllOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                  aria-label="Selecionar todos os pedidos desta página"
                />
              </TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <SortableTableHead {...sortHeaderProps('createdAt')}>Recebido</SortableTableHead>
              <SortableTableHead {...sortHeaderProps('totalInCents')}>Total</SortableTableHead>
              <TableHead>Entrega</TableHead>
              <SortableTableHead {...sortHeaderProps('status')}>Situação</SortableTableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>Carregando…</TableCell>
              </TableRow>
            )}

            {!isLoading && orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  {hasFiltersApplied
                    ? 'Nenhum pedido com esses filtros.'
                    : 'Nenhum pedido ainda. Quando um cliente fechar compra pelo WhatsApp, ele aparece aqui.'}
                </TableCell>
              </TableRow>
            )}

            {orders.map((order) => {
              const urgency = resolveOrderUrgency({ status: order.status, createdAt: order.createdAt, now })

              return (
                <TableRow key={order.id} className={URGENCY_ROW_CLASS[urgency]}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelected(order.id)}
                        aria-label={`Selecionar pedido ${order.shortCode}`}
                      />
                    </TableCell>
                    <TableCell>
                      {/* A linha inteira não abre ao clique de propósito: ela tem checkbox e botões de
                          transição, e clique solto viraria expansão acidental no meio da operação. */}
                      <button
                        type="button"
                        className="font-mono font-medium underline-offset-2 hover:underline"
                        onClick={() => openOrder(order.id)}
                      >
                        {order.shortCode}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{order.customerName ?? 'Sem nome'}</span>
                      {/* Formatado pelo mesmo `formatPhone` da inbox: número cru obriga o operador a
                          contar dígitos para achar o DDD, e duas formatações diferentes no mesmo painel
                          fazem o mesmo cliente parecer dois. */}
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {formatPhone(order.customerPhone)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* Os dois: o relativo responde "esperando há quanto tempo" e o horário responde
                          "que horas chegou" — perguntas diferentes, e a segunda é a que vai para o
                          caderno e para o telefonema. Data completa fica no title. */}
                      <span title={formatFullDateTime(order.createdAt)}>{formatWaitingFor(order.createdAt, now)}</span>
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {formatReceivedAt(order.createdAt, now)}
                      </span>
                      {urgency === ORDER_URGENCY.LATE && (
                        <span className="block text-xs font-medium text-destructive">sem confirmação</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatMoney(order.totalInCents)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {DELIVERY_LABELS[order.deliveryType] ?? order.deliveryType}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[order.status] ?? 'outline'}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openOrder(order.id)}>
                          Abrir
                        </Button>
                        {/* Filtrado pelo tipo de entrega: "saiu para entrega" não existe em retirada. */}
                        {nextStatusesFor({ status: order.status, deliveryType: order.deliveryType }).map((next) => (
                          <Button
                            key={next}
                            variant={next === 'cancelled' ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => updateStatus(order.id, next)}
                          >
                            {STATUS_LABELS[next]}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

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

type FilterRowProps = {
  label: string
  options: readonly (readonly [string, string])[]
  selected: readonly string[]
  onToggle: (value: string) => void
}

/**
 * Uma linha de filtro com seleção múltipla.
 *
 * Múltipla, e não valor único, porque o trabalho é olhar "aguardando E preparando" ao mesmo tempo —
 * filtro exclusivo obrigaria o operador a escolher qual metade do próprio trabalho enxergar.
 */
function FilterRow({ label, options, selected, onToggle }: FilterRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {options.map(([value, optionLabel]) => (
        <Button
          key={value}
          variant={selected.includes(value) ? 'default' : 'outline'}
          size="sm"
          aria-pressed={selected.includes(value)}
          onClick={() => onToggle(value)}
        >
          {optionLabel}
        </Button>
      ))}
    </div>
  )
}
