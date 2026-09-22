export type OrderReceiptData = {
  readonly orderId: string
  readonly shortCode: string
  readonly customerPhone: string
  readonly customerEmail: string | null
  readonly customerName: string | null
  readonly totalInCents: number
  readonly deliveryFeeInCents: number
  /** Teto da faixa aplicada (spec §3.7) — o recibo simples mostra "Entrega (até N km)". `null` sem faixa. */
  readonly deliveryTierMaxKm: number | null
  readonly deliveryType: string
  readonly address: unknown
  readonly paymentMethod: string
  readonly receiptPreference: string
  readonly createdAt: Date
  readonly items: readonly OrderReceiptItemData[]
  readonly fiscalDocumentId: string | null
}

export type OrderReceiptItemData = {
  readonly productName: string
  readonly unitPriceInCents: number
  readonly quantity: number
  readonly totalInCents: number
}
