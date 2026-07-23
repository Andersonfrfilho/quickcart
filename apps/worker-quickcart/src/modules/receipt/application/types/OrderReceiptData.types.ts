export type OrderReceiptData = {
  readonly orderId: string
  readonly shortCode: string
  readonly customerPhone: string
  readonly customerEmail: string | null
  readonly customerName: string | null
  readonly totalInCents: number
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
