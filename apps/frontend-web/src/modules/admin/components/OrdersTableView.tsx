import { formatPhone } from '@adatechnology/conversations-ui'
import {
  Badge,
  Button,
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { DELIVERY_LABELS, ORDER_ACTION_ICONS, orderActionLabel } from '@/modules/admin/shared/orderLabels'
import { orderStatusBadgeClass, orderStatusLabel } from '@/modules/admin/shared/orderStatusStyle'
import {
  ORDER_URGENCY,
  formatReceivedAt,
  formatWaitingFor,
  resolveOrderUrgency,
  type OrderUrgency,
} from '@/modules/admin/shared/orderUrgency'
import { ORDER_STATUS, type Order, type OrderSortableField, type SortDirection } from '@/shared/api/api.types'

/**
 * Passos que a lista NÃO desenha: cada um precisa de mais do que um clique numa linha de 40px.
 *
 * Cancelar é irreversível e manda mensagem; registrar ocorrência exige escolher o motivo, e sem ele a
 * rota recusa. Os dois moram na tela do pedido, onde há espaço para perguntar antes de gravar.
 */
const ROW_HIDDEN_STATUSES: readonly string[] = [ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERY_FAILED]

/**
 * A tabela de pedidos, sem saber de onde vêm os dados.
 *
 * Estava dentro da página, presa ao hook que exige sessão de admin — e por isso cada mudança de coluna,
 * de animação de atraso ou de estado vazio só podia ser conferida entrando no painel com login. Como
 * componente que recebe tudo por prop, a mesma tabela é montada pelo preview com dado de mentira, e a
 * verificação deixa de depender de existir um pedido atrasado de verdade na base.
 */

/** Só a linha que precisa chamar atenção carrega classe; as outras não ganham estilo à toa. */
const URGENCY_ROW_CLASS: Record<OrderUrgency, string> = {
  [ORDER_URGENCY.LATE]: 'order-row-late',
  [ORDER_URGENCY.ATTENTION]: 'order-row-attention',
  [ORDER_URGENCY.FRESH]: '',
  [ORDER_URGENCY.HANDLED]: '',
}

/** Contado a partir dos cabeçalhos abaixo: `colSpan` errado desalinha o estado vazio da tabela toda. */
const COLUMN_COUNT = 8

function formatMoney(totalInCents: number): string {
  return (totalInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatFullDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('pt-BR')
}

export type OrdersTableViewProps = {
  readonly orders: readonly Order[]
  readonly isLoading: boolean
  /**
   * O agora que a página congelou, não `Date.now()` lido em cada linha.
   *
   * Sem isso, duas linhas da mesma tabela calculam atraso em instantes diferentes, e o texto relativo
   * pisca entre "há 59 min" e "há 1 h" durante a mesma renderização.
   */
  readonly now: number
  /** Muda o texto do vazio: sem pedido nenhum é uma notícia, com filtro aplicado é um aviso. */
  readonly hasFiltersApplied: boolean
  readonly selectedIds: readonly string[]
  readonly isAllOnPageSelected: boolean
  readonly sortBy: OrderSortableField
  readonly sortDirection: SortDirection
  readonly onSort: (field: OrderSortableField) => void
  readonly onToggleSelected: (orderId: string) => void
  readonly onToggleSelectAllOnPage: () => void
  readonly onOpenOrder: (orderId: string) => void
  readonly onUpdateStatus: (orderId: string, status: string) => void
}

export function OrdersTableView({
  orders,
  isLoading,
  now,
  hasFiltersApplied,
  selectedIds,
  isAllOnPageSelected,
  sortBy,
  sortDirection,
  onSort,
  onToggleSelected,
  onToggleSelectAllOnPage,
  onOpenOrder,
  onUpdateStatus,
}: OrdersTableViewProps) {
  function sortHeaderProps(field: OrderSortableField) {
    return { active: sortBy === field, direction: sortDirection, onSort: () => onSort(field) }
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table className="table-zebra">
        <TableHeader>
          <TableRow>
            <TableHead>
              <input
                type="checkbox"
                checked={isAllOnPageSelected}
                onChange={onToggleSelectAllOnPage}
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

          {/*
            Carregando substitui as linhas, não convive com elas.
            Sem o guarda, "Carregando…" aparecia acima de uma lista desenhada — e uma lista visível durante
            a busca é uma lista que a pessoa lê como atual, quando ela pode ser a da consulta anterior.
          */}
          {!isLoading &&
            orders.map((order) => {
            const urgency = resolveOrderUrgency({ status: order.status, createdAt: order.createdAt, now })

            return (
              <TableRow
                key={order.id}
                className={`cursor-pointer ${URGENCY_ROW_CLASS[urgency]}`}
                onClick={(event) => {
                  /*
                   * A linha abre o pedido, menos quando o clique nasceu num controle dela.
                   * Sem essa checagem, marcar o checkbox ou mudar o status também navegaria — e a
                   * pessoa perderia a lista no meio de uma ação em lote.
                   */
                  if ((event.target as HTMLElement).closest('button, input, a, label')) return
                  onOpenOrder(order.id)
                }}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.id)}
                    onChange={() => onToggleSelected(order.id)}
                    aria-label={`Selecionar pedido ${order.shortCode}`}
                  />
                </TableCell>
                <TableCell>
                  {/* Continua como botão além do clique na linha: é o alvo que o teclado alcança, e
                      leitor de tela precisa de um comando nomeado, não de uma linha inteira clicável. */}
                  <button
                    type="button"
                    className="font-mono font-medium underline-offset-2 hover:underline"
                    onClick={() => onOpenOrder(order.id)}
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
                  {/* Cor própria por situação: com quatro variantes, três estados diferentes ficavam
                      idênticos justo onde é preciso distinguir de relance. */}
                  <Badge className={orderStatusBadgeClass(order.status)}>{orderStatusLabel(order.status)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {/*
                      A esteira vem do servidor, inclusive o filtro por tipo de entrega. Aqui só o passo
                      que ANDA com o pedido: cancelar e registrar ocorrência moram na tela do pedido.

                      Dois motivos. O botão vermelho ao lado do de avançar convidava a errar de alvo numa
                      lista de linhas de 40px, e cancelamento é irreversível e manda mensagem ao cliente —
                      merece a tela em que o pedido inteiro está na frente de quem decide. E era o par de
                      botões que estourava a largura da coluna, quebrando "Pronto para retirada" em duas
                      linhas e inflando a altura da linha toda.
                    */}
                    {order.allowedNextStatuses
                      .filter((next) => !ROW_HIDDEN_STATUSES.includes(next))
                      .map((next) => (
                        <Button
                          key={next}
                          variant="outline"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => onUpdateStatus(order.id, next)}
                        >
                          {/* Emoji decorativo: o rótulo ao lado já diz a ação. */}
                          <span aria-hidden="true" className="mr-1.5">
                            {ORDER_ACTION_ICONS[next] ?? '➡️'}
                          </span>
                          {orderActionLabel({ next, from: order.status })}
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
  )
}
