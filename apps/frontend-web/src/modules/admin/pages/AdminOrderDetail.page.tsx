import { useAdminOrderDetailPage } from '@/modules/admin/hooks/useAdminOrderDetailPage.hook'
import { formatWaitingFor } from '@/modules/admin/shared/orderUrgency'
import { formatPhone } from '@adatechnology/conversations-ui'
import { Badge, Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmação',
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

const DELIVERY_LABELS: Record<string, string> = { delivery: '🚚 Entrega', pickup: '🏪 Retirada' }
const PAYMENT_LABELS: Record<string, string> = {
  pix: '💳 Pix',
  card_on_delivery: '💳 Cartão na entrega',
  cash: '💵 Dinheiro',
}
const RECEIPT_LABELS: Record<string, string> = { whatsapp: '📱 WhatsApp', email: '📧 E-mail', both: '📱📧 Ambos' }

function formatMoney(totalInCents: number): string {
  return (totalInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatAddress(address: unknown): string | undefined {
  if (typeof address === 'string' && address.trim().length > 0) return address.trim()
  if (address && typeof address === 'object') return Object.values(address).filter(Boolean).join(', ')
  return undefined
}

export function AdminOrderDetailPage() {
  const {
    token,
    order,
    items,
    visibleItems,
    isLoading,
    isError,
    pickedItemIds,
    pickedCount,
    togglePicked,
    clearPicked,
    hidePickedItems,
    setHidePickedItems,
    updateStatus,
    isUpdatingStatus,
    goBackToList,
  } = useAdminOrderDetailPage()

  if (!token) return null

  if (isLoading) return <p className="p-6 text-muted-foreground">Carregando pedido…</p>

  if (isError || !order) {
    return (
      <div className="space-y-4 p-6">
        <p>Pedido não encontrado.</p>
        <Button variant="outline" onClick={goBackToList}>
          Voltar para a lista
        </Button>
      </div>
    )
  }

  const address = formatAddress(order.address)
  const isPickingDone = items.length > 0 && pickedCount === items.length
  const progressPercent = items.length > 0 ? Math.round((pickedCount / items.length) * 100) : 0

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/*
        Cabeçalho grudado no topo: a lista pode ter cinquenta itens, e quem rolou até o item 40 ainda
        precisa saber de quem é o pedido e qual botão fecha a etapa — sem voltar ao topo para lembrar.
        `print:static` para o papel não repetir a barra em cada página.
      */}
      <header className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur print:static lg:-mx-6 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={goBackToList} className="print:hidden">
                ← Pedidos
              </Button>
              <h1 className="font-mono text-2xl font-bold tracking-tight">{order.shortCode}</h1>
              <Badge variant={STATUS_VARIANTS[order.status] ?? 'outline'}>
                {STATUS_LABELS[order.status] ?? order.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.customerName ?? 'Sem nome'} · {formatPhone(order.customerPhone)} · recebido em{' '}
              <span className="tabular-nums">{new Date(order.createdAt).toLocaleString('pt-BR')}</span>{' '}
              <span className="text-xs">({formatWaitingFor(order.createdAt, Date.now())})</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Imprimir
            </Button>
            {(NEXT_STATUS[order.status] ?? []).map((next) => (
              <Button
                key={next}
                variant={next === 'cancelled' ? 'destructive' : 'default'}
                size="sm"
                disabled={isUpdatingStatus}
                onClick={() => updateStatus(next)}
              >
                {STATUS_LABELS[next]}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/*
        Entrega primeiro, e o endereço com destaque: é a informação que decide o que fazer com a
        sacola depois de separada, e é onde um erro custa a compra inteira.
      */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrega</p>
          <p className="mt-1 font-medium">{DELIVERY_LABELS[order.deliveryType] ?? order.deliveryType}</p>
          {address && <p className="mt-1 text-sm">{address}</p>}
        </Card>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamento</p>
          <p className="mt-1 font-medium">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recibo: {RECEIPT_LABELS[order.receiptPreference] ?? order.receiptPreference}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(order.totalInCents)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'itens'}
          </p>
        </Card>
      </div>

      {order.notes && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</p>
          <p className="mt-1 text-sm">{order.notes}</p>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Itens para separar</h2>
            <p className="text-sm text-muted-foreground">
              {pickedCount} de {items.length} separados
              {isPickingDone && ' — tudo pronto'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant={hidePickedItems ? 'default' : 'outline'}
              size="sm"
              aria-pressed={hidePickedItems}
              onClick={() => setHidePickedItems(!hidePickedItems)}
            >
              Esconder separados
            </Button>
            {pickedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearPicked}>
                Limpar marcações
              </Button>
            )}
          </div>
        </div>

        {/*
          Barra de progresso em vez de só o número: com lista longa, o que o operador quer de relance é
          quanto falta, e proporção se lê mais rápido que subtração.

          `<progress>` nativo em vez de duas divs com largura calculada: o elemento já é anunciado como
          barra de progresso pelo leitor de tela, e a largura sai por atributo — sem estilo inline, que
          o padrão do projeto não aceita.
        */}
        <progress
          className="picking-progress print:hidden"
          value={pickedCount}
          max={Math.max(1, items.length)}
          aria-label="Progresso da separação"
        >
          {progressPercent}%
        </progress>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 print:hidden">✓</TableHead>
                {/* Quantidade antes do nome: quem separa lê "2x" primeiro e o produto depois. */}
                <TableHead className="w-20">Qtd</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Unitário</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    {items.length === 0 ? 'Pedido sem itens.' : 'Todos os itens já foram separados.'}
                  </TableCell>
                </TableRow>
              )}

              {visibleItems.map((item) => {
                const isPicked = pickedItemIds.includes(item.id)

                return (
                  <TableRow key={item.id} className={isPicked ? 'text-muted-foreground line-through' : ''}>
                    <TableCell className="print:hidden">
                      <input
                        type="checkbox"
                        checked={isPicked}
                        onChange={() => togglePicked(item.id)}
                        aria-label={`Marcar ${item.productName} como separado`}
                        className="h-5 w-5"
                      />
                    </TableCell>
                    {/* Fonte maior na quantidade: é o número que a pessoa confere de longe na prateleira. */}
                    <TableCell className="text-lg font-bold tabular-nums">{Number(item.quantity)}x</TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(item.unitPriceInCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(item.totalInCents)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground print:hidden">
          {/* Dito na tela, e não só no código: marcação que some ao trocar de aparelho precisa avisar. */}
          As marcações de separação ficam neste aparelho e não mudam o pedido.
        </p>
      </section>
    </div>
  )
}
