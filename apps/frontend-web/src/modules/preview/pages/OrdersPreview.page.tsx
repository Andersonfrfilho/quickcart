import React from 'react'
import { useRouter } from '@/app/router'
import { Button } from '@/components/ui'
import { OrdersTableView } from '@/modules/admin/components/OrdersTableView'
import type { Order, OrderSortableField, SortDirection } from '@/shared/api/api.types'

/**
 * A tabela de pedidos com dado de mentira, para conferir desenho sem sessão de admin.
 *
 * O que esta tela existe para mostrar não é a lista feliz: é o pedido de uma hora atrás que ninguém
 * confirmou (linha pulsando), o cliente sem nome, o nome comprido que empurra a coluna, o total de três
 * dígitos, o vazio com e sem filtro. Depender da base real significava esperar um pedido atrasar de
 * verdade para ver a animação de atraso — ou fabricar um por SQL, que foi o que aconteceu antes.
 *
 * Rota só de desenvolvimento: `IS_PREVIEW_ENABLED` é constante em build time, e em produção a entrada
 * nem existe no array de rotas.
 */
const MINUTE = 60 * 1000

/** Minutos atrás de cada pedido: é o eixo que decide urgência, então é ele que a fixture varia. */
const ORDER_SAMPLES: readonly {
  readonly shortCode: string
  readonly customerName: string | null
  readonly customerPhone: string
  readonly minutesAgo: number
  readonly status: string
  readonly deliveryType: string
  readonly totalInCents: number
  readonly allowedNextStatuses: readonly string[]
  readonly deliveryFailureReason?: string
}[] = [
  {
    shortCode: 'QC-1001',
    customerName: 'Maria Aparecida da Silva',
    customerPhone: '5511988887777',
    minutesAgo: 96,
    status: 'pending_confirmation',
    deliveryType: 'delivery',
    totalInCents: 71548,
    allowedNextStatuses: ['confirmed', 'cancelled'],
  },
  {
    /*
     * Sem nome: o cliente que fechou pedido antes de o fluxo perguntar como ele se chama.
     *
     * E 18 minutos de propósito: cai na faixa de ATENÇÃO (10 a 30), que a fixture não cobria — as duas
     * primeiras linhas eram as duas atrasadas, e o estilo do meio ficava sem nenhuma linha para julgar.
     */
    shortCode: 'QC-1002',
    customerName: null,
    customerPhone: '5511977770077',
    minutesAgo: 18,
    status: 'pending_confirmation',
    deliveryType: 'pickup',
    totalInCents: 4990,
    allowedNextStatuses: ['confirmed', 'cancelled'],
  },
  {
    // Nome comprido de verdade, com sobrenome composto: é o que estoura a largura da coluna.
    shortCode: 'QC-1003',
    customerName: 'Antônio Carlos de Albuquerque Vasconcelos Neto',
    customerPhone: '5511966665555',
    minutesAgo: 28,
    status: 'confirmed',
    deliveryType: 'delivery',
    totalInCents: 128390,
    allowedNextStatuses: ['preparing', 'cancelled'],
  },
  {
    shortCode: 'QC-1004',
    customerName: 'Joana Pires',
    customerPhone: '5511955554444',
    minutesAgo: 17,
    status: 'preparing',
    deliveryType: 'delivery',
    totalInCents: 23480,
    allowedNextStatuses: ['separated', 'cancelled'],
  },
  {
    shortCode: 'QC-1005',
    customerName: 'Rafael Souza',
    customerPhone: '5511944443333',
    minutesAgo: 12,
    status: 'separated',
    deliveryType: 'pickup',
    allowedNextStatuses: ['ready_for_pickup', 'cancelled'],
    totalInCents: 8990,
  },
  {
    shortCode: 'QC-1006',
    customerName: 'Bianca Nogueira',
    customerPhone: '5511933332222',
    minutesAgo: 9,
    status: 'out_for_delivery',
    deliveryType: 'delivery',
    totalInCents: 45900,
    allowedNextStatuses: ['completed'],
  },
  {
    shortCode: 'QC-1007',
    customerName: 'Sofia Menezes',
    customerPhone: '5511922221111',
    minutesAgo: 6,
    status: 'ready_for_pickup',
    deliveryType: 'pickup',
    totalInCents: 15790,
    allowedNextStatuses: ['completed'],
  },
  {
    // Fim de linha, sem próximo passo: a coluna de ações fica vazia, e isso precisa parecer normal.
    shortCode: 'QC-1008',
    customerName: 'Pedro Henrique Lima',
    customerPhone: '5511911110000',
    minutesAgo: 3,
    status: 'completed',
    deliveryType: 'delivery',
    totalInCents: 6250,
    allowedNextStatuses: [],
  },
  {
    /*
     * Ocorrência: a linha que mostra que a coluna de ações NÃO oferece nova tentativa aqui.
     *
     * Sair de novo para a rua e cancelar dependem do motivo, e registrar ocorrência exige escolher um —
     * por isso os dois passos moram na tela do pedido, e esta linha existe para provar que a lista não os
     * desenha por engano.
     */
    shortCode: 'QC-1010',
    customerName: 'Rita Nogueira',
    customerPhone: '5511955554444',
    minutesAgo: 47,
    status: 'delivery_failed',
    deliveryType: 'delivery',
    totalInCents: 9840,
    allowedNextStatuses: ['out_for_delivery', 'cancelled'],
    deliveryFailureReason: 'customer_absent',
  },
  {
    shortCode: 'QC-1009',
    customerName: 'Carla Dias',
    customerPhone: '5511900009999',
    minutesAgo: 2,
    status: 'cancelled',
    deliveryType: 'delivery',
    totalInCents: 3190,
    allowedNextStatuses: [],
  },
]

function buildPreviewOrders(now: number): Order[] {
  return ORDER_SAMPLES.map((sample, index) => ({
    id: `preview-order-${index}`,
    shortCode: sample.shortCode,
    customerName: sample.customerName,
    customerPhone: sample.customerPhone,
    status: sample.status as Order['status'],
    deliveryType: sample.deliveryType as Order['deliveryType'],
    paymentMethod: 'pix' as Order['paymentMethod'],
    createdAt: new Date(now - sample.minutesAgo * MINUTE).toISOString(),
    totalInCents: sample.totalInCents,
    allowedNextStatuses: sample.allowedNextStatuses,
    deliveryFailureReason: (sample.deliveryFailureReason ?? null) as Order['deliveryFailureReason'],
  }))
}

export function OrdersPreviewPage() {
  /**
   * `?empty=1` mostra o estado vazio, e `?empty=filtered` o vazio com filtro aplicado.
   *
   * São dois textos diferentes para duas situações diferentes — "nenhum pedido ainda" é notícia boa,
   * "nenhum pedido com esses filtros" é aviso de que a pessoa não está vendo tudo. Em base real, ver o
   * primeiro exige uma loja sem pedido nenhum.
   */
  const { searchParams } = useRouter()
  const emptyMode = searchParams.get('empty')
  const isLoadingMode = searchParams.get('loading') === '1'

  /**
   * O agora congela numa constante do render inicial, como na página real.
   *
   * Recalcular a cada render faria "há 1 h" virar "há 1 h" de novo em instantes diferentes e a fixture
   * deixaria de ser comparável entre recarregamentos.
   */
  const [now] = React.useState(() => Date.now())
  const allOrders = React.useMemo(() => buildPreviewOrders(now), [now])
  const orders = emptyMode ? [] : allOrders

  const [selectedIds, setSelectedIds] = React.useState<readonly string[]>([])
  const [sortBy, setSortBy] = React.useState<OrderSortableField>('createdAt')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc')

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <p className="text-sm font-semibold">Preview da lista de pedidos</p>
        {/* Atalhos para os estados que a base real quase nunca tem à mão. */}
        <Button variant="outline" size="sm" onClick={() => (window.location.hash = '/preview/orders')}>
          Com pedidos
        </Button>
        <Button variant="outline" size="sm" onClick={() => (window.location.hash = '/preview/orders?empty=1')}>
          Vazio
        </Button>
        <Button variant="outline" size="sm" onClick={() => (window.location.hash = '/preview/orders?empty=filtered')}>
          Vazio com filtro
        </Button>
        <Button variant="outline" size="sm" onClick={() => (window.location.hash = '/preview/orders?loading=1')}>
          Carregando
        </Button>
      </div>

      <OrdersTableView
        orders={orders}
        isLoading={isLoadingMode}
        now={now}
        hasFiltersApplied={emptyMode === 'filtered'}
        selectedIds={selectedIds}
        isAllOnPageSelected={orders.length > 0 && selectedIds.length === orders.length}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={(field) => {
          if (field !== sortBy) {
            setSortBy(field)
            setSortDirection('asc')
            return
          }
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        }}
        onToggleSelected={(orderId) =>
          setSelectedIds((current) =>
            current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
          )
        }
        onToggleSelectAllOnPage={() =>
          setSelectedIds((current) => (current.length === orders.length ? [] : orders.map((order) => order.id)))
        }
        onOpenOrder={() => (window.location.hash = '/preview/order')}
        onUpdateStatus={() => undefined}
      />

      {selectedIds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''} — a barra de lote da tela real
          aparece aqui.
        </p>
      )}
    </div>
  )
}
