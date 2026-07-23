import type { OrderReceiptData } from '@/modules/receipt/application/types/OrderReceiptData.types'

export interface OrderReceiptRepository {
  findOrderReceiptData(orderId: string): Promise<OrderReceiptData | undefined>
  markFiscalDocumentId(orderId: string, fiscalDocumentId: string): Promise<void>
}
