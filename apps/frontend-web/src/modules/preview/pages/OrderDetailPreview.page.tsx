import React from 'react'
import { useRouter } from '@/app/router'
import { Badge } from '@/components/ui'
import {
  ORDER_STATUS_LABELS,
  orderStatusBadgeClass,
  orderStatusLabel,
} from '@/modules/admin/shared/orderStatusStyle'
import { OrderDetailView } from '@/modules/admin/components/OrderDetailView'
import type { OrderDetail, OrderItem } from '@/shared/api/api.types'

/**
 * A tela do pedido com dado de mentira, para ajustar desenho sem depender de sessão nem de um pedido
 * real com trinta itens na base.
 *
 * Rota só de desenvolvimento, como as outras de preview: `IS_PREVIEW_ENABLED` é constante em build
 * time, então em produção a entrada nem existe no array de rotas e o bundler descarta esta página.
 *
 * A lista longa é o ponto: cinco itens cabem em qualquer layout, e o que quebra — cabeçalho, rolagem,
 * alinhamento de coluna, progresso — só aparece quando a compra é do tamanho de uma compra de mês.
 */
const PRODUCT_SAMPLES: readonly (readonly [name: string, quantity: number, priceInCents: number])[] = [
  ['Arroz Branco Tipo 1 5kg', 2, 2590],
  ['Feijão Carioca 1kg', 3, 899],
  ['Leite Integral 1L', 12, 549],
  ['Café Torrado e Moído 500g', 2, 1899],
  ['Açúcar Refinado 1kg', 2, 459],
  ['Óleo de Soja 900ml', 3, 749],
  ['Macarrão Espaguete 500g', 4, 429],
  ['Molho de Tomate 340g', 6, 289],
  ['Sal Refinado 1kg', 1, 299],
  ['Farinha de Trigo 1kg', 2, 599],
  ['Ovos Brancos 12un', 2, 1290],
  ['Pão de Forma Integral', 2, 899],
  ['Manteiga com Sal 200g', 1, 1490],
  ['Queijo Mussarela Fatiado 200g', 2, 1690],
  ['Presunto Cozido Fatiado 200g', 1, 1390],
  ['Detergente Neutro 500ml', 5, 249],
  ['Sabão em Pó 1kg', 1, 1690],
  ['Amaciante 2L', 1, 1890],
  ['Papel Higiênico 12 rolos', 1, 2490],
  ['Sabonete 90g', 6, 249],
  ['Creme Dental 90g', 3, 699],
  ['Shampoo 350ml', 1, 1990],
  ['Refrigerante 2L', 4, 899],
  ['Água Mineral 1,5L', 6, 299],
  ['Suco de Laranja 1L', 3, 999],
  ['Banana Prata kg', 2, 799],
  ['Maçã Gala kg', 1, 1290],
  ['Tomate kg', 2, 899],
  ['Cebola kg', 1, 699],
  ['Batata Inglesa kg', 3, 599],
  ['Frango Inteiro Congelado kg', 2, 1499],
  ['Carne Moída Patinho kg', 1, 3990],
]

function buildPreviewItems(): OrderItem[] {
  return PRODUCT_SAMPLES.map(([productName, quantity, unitPriceInCents], index) => ({
    id: `preview-item-${index}`,
    productId: `preview-product-${index}`,
    productName,
    unitPriceInCents,
    quantity,
    totalInCents: unitPriceInCents * quantity,
    // Um item em falta no meio da lista: é o estado que precisa ser conferido no desenho, e o preview
    // existe para mostrar o caso difícil, não o feliz.
    unavailableAt: null,
    unavailableNotifiedAt: null,
  }))
}

const PREVIEW_ITEMS = buildPreviewItems()

const PREVIEW_ORDER: OrderDetail = {
  id: 'preview-order',
  shortCode: 'QC-1042',
  customerName: 'Maria Aparecida da Silva',
  customerPhone: '5511988887777',
  // `preparing` porque é o estado em que esta tela é usada: o pedido está sendo separado.
  status: 'preparing',
  deliveryType: 'delivery',
  paymentMethod: 'pix',
  receiptPreference: 'whatsapp',
  address: 'Rua das Acácias, 412, apto 71, Bloco B — Jardim Paulista, São Paulo/SP, 01415-000',
  notes: 'Se não tiver banana prata, pode trocar por nanica. Interfone quebrado, ligar ao chegar.',
  // Uma hora atrás: cai na faixa de atraso, que é o estado em que a tela mais precisa funcionar.
  createdAt: new Date(Date.now() - 62 * 60 * 1000).toISOString(),
  totalInCents: PREVIEW_ITEMS.reduce((total, item) => total + item.totalInCents, 0),
  items: PREVIEW_ITEMS,
}

export function OrderDetailPreviewPage() {
  /**
   * Estado e tipo de entrega vêm da URL para conferir os casos difíceis sem editar código.
   *
   * `?status=separated&deliveryType=pickup` mostra a esteira de retirada; sem parâmetro, cai no caso
   * que interessa mais (entrega sendo separada). Sem isso, cada verificação de layout exigia editar a
   * fixture, salvar e recarregar — e o caminho que ninguém checa é o que quebra.
   */
  const { searchParams } = useRouter()
  const status = searchParams.get('status') ?? 'preparing'
  const deliveryType = searchParams.get('deliveryType') ?? 'delivery'

  const [pickedItemIds, setPickedItemIds] = React.useState<readonly string[]>([
    'preview-item-0',
    'preview-item-1',
    'preview-item-2',
  ])
  const [hidePickedItems, setHidePickedItems] = React.useState(false)
  // No preview a falta é local: serve para ver o estado na tela, sem pedido nem cliente de verdade.
  const [unavailableItemIds, setUnavailableItemIds] = React.useState<readonly string[]>(['preview-item-4'])
  const [notifiedItemIds, setNotifiedItemIds] = React.useState<readonly string[]>([])

  const items = React.useMemo(
    () =>
      PREVIEW_ITEMS.map((item) => ({
        ...item,
        unavailableAt: unavailableItemIds.includes(item.id) ? new Date().toISOString() : null,
        unavailableNotifiedAt: notifiedItemIds.includes(item.id) ? new Date().toISOString() : null,
      })),
    [unavailableItemIds, notifiedItemIds],
  )

  const visibleItems = hidePickedItems ? items.filter((item) => !pickedItemIds.includes(item.id)) : items

  /**
   * Total recalculado também aqui.
   *
   * No produto quem recalcula é o servidor; no preview, deixar o total parado enquanto um item sai da
   * lista faria a tela ensinar errado — e é justamente o número que eu preciso conferir olhando.
   */
  const order: OrderDetail = {
    ...PREVIEW_ORDER,
    status: status as OrderDetail['status'],
    deliveryType: deliveryType as OrderDetail['deliveryType'],
    // Retirada não tem endereço: mostrar um faria a tela ensinar errado.
    address: deliveryType === 'pickup' ? null : PREVIEW_ORDER.address,
    items,
    totalInCents: items
      .filter((item) => item.unavailableAt === null)
      .reduce((total, item) => total + item.totalInCents, 0),
  }

  return (
    <>
      {/*
        Amostra das cores de situação, só no preview: cor por status se julga vendo as oito juntas, não uma
        por vez em pedidos diferentes. Se duas ficarem parecidas, é aqui que aparece.
      */}
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        {Object.keys(ORDER_STATUS_LABELS).map((status) => (
          <Badge key={status} className={orderStatusBadgeClass(status)}>
            {orderStatusLabel(status)}
          </Badge>
        ))}
      </div>

    <OrderDetailView
      order={order}
      items={items}
      visibleItems={visibleItems}
      pickedItemIds={pickedItemIds}
      pickedCount={pickedItemIds.length}
      hidePickedItems={hidePickedItems}
      isUpdatingStatus={false}
      onTogglePicked={(itemId) =>
        setPickedItemIds((current) =>
          current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
        )
      }
      onClearPicked={() => setPickedItemIds([])}
      onPickAll={() =>
        setPickedItemIds(items.filter((item) => item.unavailableAt === null).map((item) => item.id))
      }
      onToggleHidePicked={setHidePickedItems}
      onUpdateStatus={() => undefined}
      onSetUnavailable={({ itemId, unavailable }) => {
        setUnavailableItemIds((current) =>
          unavailable ? [...current, itemId] : current.filter((id) => id !== itemId),
        )
        // Desmarcar limpa o aviso, como o servidor faz: item que voltou não teve falta avisada.
        if (!unavailable) setNotifiedItemIds((current) => current.filter((id) => id !== itemId))
      }}
      onNotifyUnavailable={() => setNotifiedItemIds(unavailableItemIds)}
      isNotifyingUnavailable={false}
      onOpenConversation={() => undefined}
      onBack={() => undefined}
    />
    </>
  )
}
