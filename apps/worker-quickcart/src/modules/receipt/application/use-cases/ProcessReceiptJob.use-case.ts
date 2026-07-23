import type { ReceiptProvider } from '@/modules/receipt/application/providers/ReceiptProvider.interface'
import type { EmailProvider } from '@/modules/receipt/application/providers/EmailProvider.interface'
import type { OrderReceiptRepository } from '@/modules/receipt/infra/repositories/OrderReceiptRepository.interface'
import type { OrderReceiptData } from '@/modules/receipt/application/types/OrderReceiptData.types'
import type { ProcessReceiptJobParams } from '@/modules/receipt/application/types/ProcessReceiptJob.types'
import { environment } from '@/infra/config/environment'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'

export type ReceiptIdempotencyGuard = {
  readonly wasProcessed: (key: string) => Promise<boolean>
  readonly markProcessed: (key: string) => Promise<void>
}

export type ReceiptWhatsAppSender = {
  readonly sendMedia: (to: string, pdf: Buffer, caption: string) => Promise<unknown>
}

type ProcessReceiptJobDependencies = {
  readonly idempotencyGuard: ReceiptIdempotencyGuard
  readonly orderReceiptRepository: OrderReceiptRepository
  readonly receiptProvider: ReceiptProvider
  readonly emailProvider: EmailProvider
  readonly whatsAppSender: ReceiptWhatsAppSender
}

const receiptLog = logger.child('ReceiptProcessor')

const RECEIPT_PREFERENCE = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  BOTH: 'both',
} as const

export class ProcessReceiptJobUseCase {
  constructor(private readonly dependencies: ProcessReceiptJobDependencies) {}

  async execute(params: ProcessReceiptJobParams): Promise<void> {
    const { jobId, orderId } = params
    const idempotencyKey = `receipt:processed:${orderId}`

    if (await this.dependencies.idempotencyGuard.wasProcessed(idempotencyKey)) {
      receiptLog.info(LOG_EVENTS.RECEIPT_JOB_PROCESSED, { jobId, orderId, alreadyProcessed: true })
      return
    }

    const orderData = await this.dependencies.orderReceiptRepository.findOrderReceiptData(orderId)
    if (!orderData) {
      receiptLog.warn(LOG_EVENTS.RECEIPT_JOB_FAILED, { jobId, orderId, reason: 'order_not_found' })
      return
    }

    const result = await this.dependencies.receiptProvider.generate({
      shortCode: orderData.shortCode,
      customerName: orderData.customerName,
      items: orderData.items,
      totalInCents: orderData.totalInCents,
      deliveryType: orderData.deliveryType,
      paymentMethod: orderData.paymentMethod,
      address: orderData.address,
      createdAt: orderData.createdAt,
      storeName: environment.STORE_NAME,
      storeCnpj: environment.STORE_CNPJ,
      storeAddress: environment.STORE_ADDRESS,
    })

    if (result.fiscalDocumentId) {
      await this.dependencies.orderReceiptRepository.markFiscalDocumentId(orderId, result.fiscalDocumentId)
    }

    await this.deliverReceipt(orderData, result.pdf)
    await this.dependencies.idempotencyGuard.markProcessed(idempotencyKey)

    receiptLog.info(LOG_EVENTS.RECEIPT_JOB_PROCESSED, { jobId, orderId })
  }

  private async deliverReceipt(orderData: OrderReceiptData, pdf: Buffer): Promise<void> {
    const preference = orderData.receiptPreference
    const caption = `Comprovante do pedido ${orderData.shortCode}`
    const subject = `Comprovante - Pedido ${orderData.shortCode} - ${environment.STORE_NAME}`

    const sendWhatsApp = preference === RECEIPT_PREFERENCE.WHATSAPP || preference === RECEIPT_PREFERENCE.BOTH
    const sendEmail = (preference === RECEIPT_PREFERENCE.EMAIL || preference === RECEIPT_PREFERENCE.BOTH) && orderData.customerEmail

    if (sendWhatsApp) {
      try {
        await this.dependencies.whatsAppSender.sendMedia(orderData.customerPhone, pdf, caption)
      } catch (error) {
        receiptLog.error(LOG_EVENTS.RECEIPT_JOB_FAILED, { orderId: orderData.orderId, channel: 'whatsapp', error: String(error) })
      }
    }

    if (sendEmail && orderData.customerEmail) {
      try {
        await this.dependencies.emailProvider.sendReceipt({
          to: orderData.customerEmail,
          subject,
          pdf,
          shortCode: orderData.shortCode,
          storeName: environment.STORE_NAME,
        })
      } catch (error) {
        receiptLog.error(LOG_EVENTS.RECEIPT_JOB_FAILED, { orderId: orderData.orderId, channel: 'email', error: String(error) })
      }
    }
  }
}
