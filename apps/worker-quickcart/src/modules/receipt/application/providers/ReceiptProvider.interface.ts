export type ReceiptParams = {
  readonly shortCode: string
  readonly customerName: string | null
  readonly items: ReadonlyArray<{
    readonly productName: string
    readonly unitPriceInCents: number
    readonly quantity: number
    readonly totalInCents: number
  }>
  readonly totalInCents: number
  readonly deliveryType: string
  readonly paymentMethod: string
  readonly address: unknown
  readonly createdAt: Date
  readonly storeName: string
  readonly storeCnpj?: string | undefined
  readonly storeAddress?: string | undefined
}

export type ReceiptResult = {
  readonly pdf: Buffer
  readonly fiscalDocumentId: string | null
}

export interface ReceiptProvider {
  generate(params: ReceiptParams): Promise<ReceiptResult>
}
