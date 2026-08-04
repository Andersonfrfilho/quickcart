import React from 'react'
import { useRouter } from '@/app/router'
import { Badge } from '@/components/ui'
import {
  ORDER_STATUS_LABELS,
  orderStatusBadgeClass,
  orderStatusLabel,
} from '@/modules/admin/shared/orderStatusStyle'
import { OrderDetailView } from '@/modules/admin/components/OrderDetailView'
import type { OrderDeliveryEstimate, OrderDetail, OrderItem } from '@/shared/api/api.types'

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
    pickedAt: null,
  }))
}

const PREVIEW_ITEMS = buildPreviewItems()

/**
 * O que o SERVIDOR responderia em `allowedNextStatuses`, espelhado aqui só para o preview funcionar.
 *
 * É mock, não regra: a esteira de verdade vive em `apps/api-quickcart/.../orderStatusFlow.ts` e é ela que
 * decide. Se este espelho divergir, quem quebra é o preview — a tela real desenha o que a API mandar.
 */
function previewAllowedNextStatuses(status: string, deliveryType: string): readonly string[] {
  const byStatus: Record<string, readonly string[]> = {
    pending_confirmation: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['separated', 'cancelled'],
    separated: [deliveryType === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery', 'cancelled'],
    out_for_delivery: ['completed'],
    ready_for_pickup: ['completed'],
  }
  return byStatus[status] ?? []
}

/**
 * Os três casos que `formatAddress` (OrderDetailView.tsx) precisa distinguir — nenhuma base real
 * tem os três ao mesmo tempo, e é exatamente por isso que o preview existe.
 *
 * `?address=structured` — pedido novo (pós T2.1), com os campos que `isStructuredAddress` exige.
 * `?address=legacy` — backfill (Fase 4) não achou CEP no texto livre; preservou o original.
 * `?address=raw` — pedido de antes da migração, nunca tocado pelo backfill: string crua do
 * checkout antigo, sem `legacyAddressText`.
 */
type PreviewAddressCase = { readonly address: unknown; readonly legacyAddressText: string | null }

/**
 * Uma função, não `Record<string, ...>` indexado por chave livre — com `noUncheckedIndexedAccess`,
 * o índice sempre carrega `| undefined`, e o fallback também vinha de um índice, então o TypeScript
 * não conseguia provar que o resultado final era sempre definido.
 */
function resolvePreviewAddressCase(addressCase: string): PreviewAddressCase {
  if (addressCase === 'legacy') {
    return { address: null, legacyAddressText: 'manda na rua de trás do posto, portão verde' }
  }
  if (addressCase === 'raw') {
    return {
      address: 'Rua das Acácias, 412, apto 71, Bloco B — Jardim Paulista, São Paulo/SP, 01415-000',
      legacyAddressText: null,
    }
  }
  return {
    address: {
      cep: '01415-000',
      street: 'Rua das Acácias',
      number: '412',
      complement: 'apto 71, Bloco B',
      neighborhood: 'Jardim Paulista',
      city: 'São Paulo',
      state: 'SP',
      reference: 'portão azul ao lado da padaria',
    },
    legacyAddressText: null,
  }
}

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
  ...resolvePreviewAddressCase('structured'),
  notes: 'Se não tiver banana prata, pode trocar por nanica. Interfone quebrado, ligar ao chegar.',
  // Uma hora atrás: cai na faixa de atraso, que é o estado em que a tela mais precisa funcionar.
  createdAt: new Date(Date.now() - 62 * 60 * 1000).toISOString(),
  totalInCents: PREVIEW_ITEMS.reduce((total, item) => total + item.totalInCents, 0),
  items: PREVIEW_ITEMS,
  allowedNextStatuses: [],
}

/**
 * Os quatro estados da distância — `?estimate=`.
 *
 * `perto` é o caso feliz; `longe` é o aviso de fora do raio; `aproximada` é o CEP genérico de cidade
 * pequena, em que a tela mostra distância e NÃO promete horário; `ausente` é retirada, loja sem CEP
 * configurado, endereço legado ou mapa fora do ar — todos indistinguíveis na tela de propósito, porque
 * a única coisa honesta a dizer é nada.
 */
function resolvePreviewEstimate(estimateCase: string): OrderDeliveryEstimate | undefined {
  if (estimateCase === 'longe') {
    return { distanceKm: 12.4, minMinutes: 55, maxMinutes: 100, isApproximate: false, isOutsideRadius: true }
  }
  if (estimateCase === 'aproximada') {
    return { distanceKm: 47.8, isApproximate: true, isOutsideRadius: true }
  }
  if (estimateCase === 'ausente') return undefined
  return { distanceKm: 2.1, minMinutes: 25, maxMinutes: 45, isApproximate: false, isOutsideRadius: false }
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
  const addressCase = searchParams.get('address') ?? 'structured'
  const estimateCase = searchParams.get('estimate') ?? 'perto'

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
        // No produto quem marca é o servidor (`pickedAt`); aqui o estado local faz o papel dele.
        pickedAt: pickedItemIds.includes(item.id) ? new Date().toISOString() : null,
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
    allowedNextStatuses: previewAllowedNextStatuses(status, deliveryType),
    /*
     * Retirada não tem endereço: mostrar um faria a tela ensinar errado. Fora disso, o caso vem de
     * `?address=`, para testar estruturado, legado e cru sem precisar editar a fixture.
     */
    ...(deliveryType === 'pickup' ? { address: null, legacyAddressText: null } : resolvePreviewAddressCase(addressCase)),
    // Retirada nunca tem distância: o cliente vem até a loja.
    ...(deliveryType === 'pickup'
      ? {}
      : (() => {
          const deliveryEstimate = resolvePreviewEstimate(estimateCase)
          return deliveryEstimate ? { deliveryEstimate } : {}
        })()),
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
