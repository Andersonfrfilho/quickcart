export type Pagination = {
  readonly total: number
  readonly page: number
  readonly perPage: number
}

export type ApiListResponse<TItem> = {
  readonly data: TItem[]
  readonly pagination: Pagination
}

export type ApiCollectionResponse<TItem> = {
  readonly data: TItem[]
}

export type ApiItemResponse<TItem> = {
  readonly data: TItem
}

export type Category = {
  readonly id: string
  readonly name: string
  readonly emoji: string | null
}

export type Product = {
  readonly id: string
  readonly categoryId: string
  readonly name: string
  readonly brand: string | null
  readonly unitSize: string | null
  readonly priceInCents: number
  readonly stockQuantity: number
  readonly isAvailable: boolean
  readonly imageUrl: string | null
  /**
   * Apelidos que o casador usa para reconhecer o produto na fala do cliente.
   *
   * Declarado aqui porque a tela de demanda ACRESCENTA um apelido, e a rota de atualização substitui a
   * lista inteira — sem os atuais em mãos, salvar um apelido novo apagaria os antigos em silêncio.
   */
  readonly aliases: readonly string[]
}

/**
 * Termo que clientes pediram e a loja não tinha, já agregado.
 *
 * Sem identificar quem pediu: a decisão do lojista é sobre o catálogo, e nome de cliente não entra em
 * tela de relatório sem precisar.
 */
export const UNMATCHED_DEMAND_SOURCE = {
  /** O catálogo não tem nada parecido. Falta de produto. */
  LIST: 'list',
  /** Havia candidatos e o cliente respondeu "nenhum desses". Falta do produto CERTO. */
  RESOLUTION_SKIPPED: 'resolution_skipped',
  /** A loja vende, mas acabou na hora de separar. Falta reposição, não cadastro. */
  OUT_OF_STOCK: 'out_of_stock',
} as const
export type UnmatchedDemandSource = (typeof UNMATCHED_DEMAND_SOURCE)[keyof typeof UNMATCHED_DEMAND_SOURCE]

export const UNMATCHED_DEMAND_SORTABLE_FIELDS = [
  'customerCount',
  'requestCount',
  'lastRequestedAt',
  'term',
] as const
export type UnmatchedDemandSortableField = (typeof UNMATCHED_DEMAND_SORTABLE_FIELDS)[number]

export type UnmatchedDemand = {
  readonly term: string
  /** Como foi falado da última vez — inclusive com erro de transcrição, que é o dado útil aqui. */
  readonly lastRawTerm: string
  readonly requestCount: number
  readonly customerCount: number
  readonly lastRequestedAt: string
  /**
   * Todas as origens do termo na janela, porque um termo pode ter faltado por motivos diferentes.
   *
   * É o que separa "cadastrar produto" de "repor prateleira" — decisões com orçamentos diferentes, e
   * sem isto a linha não diz qual das duas o lojista está olhando.
   */
  readonly sources: readonly UnmatchedDemandSource[]
}

export const ORDER_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  /** Itens na sacola, esperando entregador ou cliente. */
  SEPARATED: 'separated',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  READY_FOR_PICKUP: 'ready_for_pickup',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export type DeliveryType = 'delivery' | 'pickup'
export type PaymentMethod = 'pix' | 'card_on_delivery' | 'cash'
export type ReceiptPreference = 'whatsapp' | 'email' | 'both'

export type Order = {
  readonly id: string
  readonly shortCode: string
  readonly customerName: string | null
  readonly customerPhone: string
  readonly totalInCents: number
  readonly status: OrderStatus
  readonly deliveryType: DeliveryType
  readonly paymentMethod: PaymentMethod
  readonly createdAt: string
  /**
   * Próximos passos válidos, decididos pelo SERVIDOR.
   *
   * A tela desenhava botões a partir de um mapa próprio, que era a segunda cópia da esteira — e a rota
   * aceitava qualquer status, então o mapa do front era o único guarda-corpo. Agora quem manda é a API, e a
   * tela só desenha o que ela permite.
   */
  readonly allowedNextStatuses: readonly string[]
}

export type OrderItem = {
  readonly id: string
  readonly productId: string
  readonly productName: string
  readonly unitPriceInCents: number
  /** Decimal para peso ("1.5 kg"), então chega como string do banco em alguns drivers. */
  readonly quantity: number | string
  readonly totalInCents: number
  /**
   * Quando a loja descobriu, separando, que o item acabou. `null` é o normal.
   *
   * Vem do servidor, ao contrário da marca de "separado": item em falta muda o que o cliente paga, e
   * marca que muda dinheiro não pode viver só no aparelho de quem separou.
   */
  readonly unavailableAt: string | null
  /** `null` com `unavailableAt` preenchido = falta registrada e cliente ainda não avisado. */
  readonly unavailableNotifiedAt: string | null
}

/**
 * A que distância o cliente está e quando o pedido chega.
 *
 * Chave AUSENTE quando o servidor não consegue responder com honestidade: retirada, loja sem CEP
 * configurado, endereço legado sem CEP, CEP que não geocodifica, mapa fora do ar. A tela decide por
 * presença — nunca preenche com zero nem com "—", que o operador leria como "é pertinho".
 */
export type OrderDeliveryEstimate = {
  readonly distanceKm: number
  /** Ausentes quando a precisão da coordenada não sustenta previsão (centroide de município). */
  readonly minMinutes?: number
  readonly maxMinutes?: number
  readonly isApproximate: boolean
  /** Aviso ao operador, nunca trava na venda: a coordenada vem de CEP e erra. */
  readonly isOutsideRadius: boolean
}

/**
 * O pedido aberto para a loja: o que separar, para quem e como entregar.
 *
 * Endereço e recibo só existem aqui, e não na listagem: a lista precisa caber na tela e ninguém escolhe
 * pedido pelo endereço — mas quem vai entregar não pode ter de adivinhar.
 */
export type OrderDetail = Order & {
  readonly address: unknown
  readonly deliveryEstimate?: OrderDeliveryEstimate
  /** `null` quando não há texto original a preservar — todo pedido, exceto o que o backfill (Fase 4) tocou. */
  readonly legacyAddressText: string | null
  readonly receiptPreference: ReceiptPreference
  readonly notes: string | null
  readonly items: readonly OrderItem[]
}

export const PRODUCT_SORTABLE_FIELDS = ['name', 'priceInCents', 'stockQuantity', 'createdAt'] as const
export type ProductSortableField = (typeof PRODUCT_SORTABLE_FIELDS)[number]

export const ORDER_SORTABLE_FIELDS = ['createdAt', 'totalInCents', 'status'] as const
export type OrderSortableField = (typeof ORDER_SORTABLE_FIELDS)[number]

export type SortDirection = 'asc' | 'desc'
