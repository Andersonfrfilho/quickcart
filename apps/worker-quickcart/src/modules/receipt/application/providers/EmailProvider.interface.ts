export type SendEmailReceiptParams = {
  readonly to: string
  readonly subject: string
  readonly pdf: Buffer
  readonly shortCode: string
  readonly storeName: string
}

export interface EmailProvider {
  sendReceipt(params: SendEmailReceiptParams): Promise<void>
}
