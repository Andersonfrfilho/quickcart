export type ReceiptParams = {
  readonly shortCode: string
  readonly customerName: string | null
  readonly items: ReadonlyArray<{
    readonly productName: string
    readonly unitPriceInCents: number
    readonly quantity: number
    readonly totalInCents: number
  }>
  /** Só os itens — é o pagamento da NFC-e. */
  readonly totalInCents: number
  /** Taxa de entrega, fora do total. A NFC-e ignora; o recibo simples mostra. */
  readonly deliveryFeeInCents: number
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
