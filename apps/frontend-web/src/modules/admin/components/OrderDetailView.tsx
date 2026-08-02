import { formatPhone } from '@adatechnology/conversations-ui'
import { ORDER_URGENCY, formatWaitingFor, resolveOrderUrgency } from '@/modules/admin/shared/orderUrgency'
import { Badge, Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
import type { OrderDetail, OrderItem } from '@/shared/api/api.types'

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

/**
 * O que o botão FAZ, não o estado que ele representa.
 *
 * A tela mostrava "Confirmado" e "Cancelado" lado a lado, que são nomes de situação — lidos juntos,
 * pareciam dizer que o pedido já estava confirmado e cancelado ao mesmo tempo. Botão é verbo.
 */
const STATUS_ACTION_LABELS: Record<string, string> = {
  confirmed: 'Confirmar pedido',
  preparing: 'Iniciar separação',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluir',
  cancelled: 'Cancelar pedido',
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

export type OrderDetailViewProps = {
  readonly order: OrderDetail
  readonly items: readonly OrderItem[]
  readonly visibleItems: readonly OrderItem[]
  readonly pickedItemIds: readonly string[]
  readonly pickedCount: number
  readonly hidePickedItems: boolean
  readonly isUpdatingStatus: boolean
  readonly onTogglePicked: (itemId: string) => void
  readonly onClearPicked: () => void
  readonly onToggleHidePicked: (hide: boolean) => void
  readonly onUpdateStatus: (status: string) => void
  readonly onBack: () => void
}

/**
 * A tela do pedido, sem saber de onde vem o dado.
 *
 * Separada da página pelo padrão do projeto (página declarativa, lógica no hook) e por um motivo
 * prático: desenho só se ajusta olhando. Como componente puro, ela também renderiza numa rota de
 * preview com pedido de mentira e lista longa — que é o caso difícil e o que ninguém reproduz à mão.
 */
export function OrderDetailView({
  order,
  items,
  visibleItems,
  pickedItemIds,
  pickedCount,
  hidePickedItems,
  isUpdatingStatus,
  onTogglePicked,
  onClearPicked,
  onToggleHidePicked,
  onUpdateStatus,
  onBack,
}: OrderDetailViewProps) {
  const address = formatAddress(order.address)
  const urgency = resolveOrderUrgency({ status: order.status, createdAt: order.createdAt, now: Date.now() })
  const isLate = urgency === ORDER_URGENCY.LATE
  const isPickingDone = items.length > 0 && pickedCount === items.length
  const progressPercent = items.length > 0 ? Math.round((pickedCount / items.length) * 100) : 0

  /*
   * Largura máxima: em monitor largo a linha esticava até o nome do produto e o preço ficarem em
   * pontas opostas da tela, e o olho perdia a associação entre os dois. Conteúdo de leitura tem
   * largura útil; o resto é margem.
   */
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:space-y-6 lg:p-6">
      {/*
        Cabeçalho grudado no topo: a lista pode ter cinquenta itens, e quem rolou até o item 40 ainda
        precisa saber de quem é o pedido e qual botão fecha a etapa — sem voltar ao topo para lembrar.
        `print:static` para o papel não repetir a barra em cada página.
      */}
      {/*
        Fixo no topo fica só o mínimo para não se perder: voltar, código, urgência e a ação principal.
        No celular o cabeçalho completo comia 500 dos 812 pixels da tela — sobrava espaço para UM item,
        e ele é fixo, então roubava a tela inteira durante a rolagem. Quem separa precisa da lista.
      */}
      <header className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur print:static lg:-mx-6 lg:px-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="print:hidden">
          ←<span className="ml-1 hidden sm:inline">Pedidos</span>
        </Button>

        <h1 className="font-mono text-xl font-bold tracking-tight lg:text-2xl">{order.shortCode}</h1>

        <Badge variant={isLate ? 'destructive' : 'outline'}>
          {isLate ? 'esperando ' : ''}
          {formatWaitingFor(order.createdAt, Date.now())}
        </Badge>

        {/* Situação some no celular: o botão de ação já diz onde o pedido está na esteira. */}
        <Badge variant={STATUS_VARIANTS[order.status] ?? 'outline'} className="hidden sm:inline-flex">
          {STATUS_LABELS[order.status] ?? order.status}
        </Badge>

        <div className="ml-auto flex items-center gap-2 print:hidden">
          {/* Imprimir é de balcão, não de corredor: só aparece de tablet para cima. */}
          <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:inline-flex">
            Imprimir
          </Button>
          {(NEXT_STATUS[order.status] ?? [])
            .filter((next) => next !== 'cancelled')
            .map((next) => (
              <Button key={next} size="sm" disabled={isUpdatingStatus} onClick={() => onUpdateStatus(next)}>
                {STATUS_ACTION_LABELS[next] ?? STATUS_LABELS[next]}
              </Button>
            ))}
        </div>
      </header>

      {/*
        Quem é o cliente e quando pediu não precisa ficar grudado na tela o tempo todo: é consulta de
        uma vez, no começo ou na hora de ligar. Fora do fixo, devolve altura para a lista.
      */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{order.customerName ?? 'Sem nome'}</span>
        <a href={`tel:${order.customerPhone}`} className="tabular-nums underline-offset-2 hover:underline">
          {formatPhone(order.customerPhone)}
        </a>
        <span className="tabular-nums">
          {new Date(order.createdAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {/* Cancelar sai do topo: é ação rara e destrutiva, e no cabeçalho disputava espaço com o que se
            usa toda hora. Aqui, discreto, continua a um toque de distância. */}
        {(NEXT_STATUS[order.status] ?? []).includes('cancelled') && (
          <button
            type="button"
            disabled={isUpdatingStatus}
            onClick={() => onUpdateStatus('cancelled')}
            className="text-destructive underline-offset-2 hover:underline print:hidden"
          >
            {STATUS_ACTION_LABELS.cancelled}
          </button>
        )}
      </p>

      {/*
        Entrega primeiro, e o endereço com destaque: é a informação que decide o que fazer com a
        sacola depois de separada, e é onde um erro custa a compra inteira.
      */}
      {/*
        Duas colunas no celular, três no monitor. Empilhados, os três cards gastavam 700 dos 812 pixels
        antes do primeiro item — informação de conferência ocupando a tela de quem veio trabalhar.
        Entrega atravessa as duas colunas porque o endereço é a linha longa e quebrar em duas empilha
        ainda mais.
      */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="col-span-2 p-3 md:col-span-1 md:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrega</p>
          <p className="mt-0.5 font-medium">{DELIVERY_LABELS[order.deliveryType] ?? order.deliveryType}</p>
          {address && <p className="mt-0.5 text-sm">{address}</p>}
        </Card>

        <Card className="p-3 md:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamento</p>
          <p className="mt-0.5 font-medium">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Recibo: {RECEIPT_LABELS[order.receiptPreference] ?? order.receiptPreference}
          </p>
        </Card>

        <Card className="p-3 md:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-0.5 text-xl font-bold md:text-2xl">{formatMoney(order.totalInCents)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'itens'}
          </p>
        </Card>
      </div>

      {/*
        Observação do cliente muda a separação ("pode trocar por nanica", "ligar ao chegar") e estava
        com a mesma cara de um rodapé qualquer. Borda âmbar e ícone: é a única parte da tela escrita
        por uma pessoa, e ler depois de separar não adianta.
      */}
      {order.notes && (
        <Card className="border-l-4 border-l-amber-500 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
            ⚠️ Observações do cliente
          </p>
          <p className="mt-1 text-sm font-medium">{order.notes}</p>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Itens para separar</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {pickedCount}/{items.length}
              </span>{' '}
              separados · {progressPercent}%
              {isPickingDone && ' — tudo pronto ✅'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant={hidePickedItems ? 'default' : 'outline'}
              size="sm"
              aria-pressed={hidePickedItems}
              onClick={() => onToggleHidePicked(!hidePickedItems)}
            >
              Esconder separados
            </Button>
            {pickedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearPicked}>
                Limpar marcações
              </Button>
            )}
          </div>
        </div>

        {/*
          `<progress>` nativo em vez de duas divs com largura calculada: já é anunciado como barra de
          progresso pelo leitor de tela e a proporção sai por atributo, sem estilo inline.
        */}
        <progress
          className="picking-progress print:hidden"
          value={pickedCount}
          max={Math.max(1, items.length)}
          aria-label="Progresso da separação"
        >
          {progressPercent}%
        </progress>

        {/*
          Lista, e não tabela de planilha.
          Separar é conferir NOME e QUANTIDADE; preço unitário e subtotal são conferência de caixa, e
          ocupavam metade da largura empurrando o nome do produto — a informação de que a pessoa
          precisa — para um canto. Agora o preço fica à direita, discreto, e a linha inteira é o alvo
          do toque: no corredor, com celular na mão, mirar um quadradinho de vinte pixels é o que faz
          a pessoa desistir de marcar.
        */}
        <ul className="divide-y rounded-lg border bg-card">
          {visibleItems.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              {items.length === 0 ? 'Pedido sem itens.' : 'Todos os itens já foram separados.'}
            </li>
          )}

          {visibleItems.map((item) => {
            const isPicked = pickedItemIds.includes(item.id)

            return (
              <li key={item.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50 ${
                    isPicked ? 'opacity-55' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isPicked}
                    onChange={() => onTogglePicked(item.id)}
                    aria-label={`Marcar ${item.productName} como separado`}
                    className="h-6 w-6 shrink-0 print:hidden"
                  />

                  {/* Quantidade em bloco fixo: com números alinhados, a coluna vira uma régua de conferência. */}
                  <span className="w-14 shrink-0 text-right text-xl font-bold tabular-nums">
                    {Number(item.quantity)}
                    <span className="text-sm font-normal text-muted-foreground">x</span>
                  </span>

                  {/*
                    Risco só no NOME, nunca no preço: item separado continua valendo o que vale, e
                    riscar o valor sugere desconto ou remoção.
                  */}
                  <span className={`min-w-0 flex-1 font-medium ${isPicked ? 'line-through' : ''}`}>
                    {item.productName}
                  </span>

                  <span className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                    {formatMoney(item.unitPriceInCents)} un
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums">{formatMoney(item.totalInCents)}</span>
                </label>
              </li>
            )
          })}
        </ul>

        <p className="text-xs text-muted-foreground print:hidden">
          {/* Dito na tela, e não só no código: marcação que some ao trocar de aparelho precisa avisar. */}
          As marcações de separação ficam neste aparelho e não mudam o pedido.
        </p>
      </section>
    </div>
  )
}
