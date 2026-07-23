import { describe, expect, test, mock } from 'bun:test'
import { ProcessReceiptJobUseCase } from './ProcessReceiptJob.use-case'
import type { OrderReceiptData } from '@/modules/receipt/application/types/OrderReceiptData.types'

class FakeIdempotencyGuard {
  private readonly processed = new Set<string>()

  async wasProcessed(key: string): Promise<boolean> {
    return this.processed.has(key)
  }

  async markProcessed(key: string): Promise<void> {
    this.processed.add(key)
  }
}

const ORDER_DATA: OrderReceiptData = {
  orderId: 'order-1',
  shortCode: 'QC-1234',
  customerPhone: '5511999999999',
  customerEmail: 'cliente@email.com',
  customerName: 'Fulano',
  totalInCents: 5000,
  deliveryType: 'delivery',
  address: { street: 'Rua X, 123' },
  paymentMethod: 'pix',
  receiptPreference: 'whatsapp',
  createdAt: new Date(),
  fiscalDocumentId: null,
  items: [
    { productName: 'Arroz Tio Joao 1kg', unitPriceInCents: 800, quantity: 2, totalInCents: 1600 },
    { productName: 'Leite Integral 1L', unitPriceInCents: 500, quantity: 1, totalInCents: 500 },
  ],
}

function buildUseCase(orderData?: OrderReceiptData | undefined) {
  const idempotencyGuard = new FakeIdempotencyGuard()
  const findOrderReceiptData = mock().mockResolvedValue(orderData ?? null)
  const markFiscalDocumentId = mock().mockResolvedValue(undefined)
  const receiptProvider = mock().mockResolvedValue({ pdf: Buffer.from('pdf'), fiscalDocumentId: null })
  const emailProvider = mock().mockResolvedValue(undefined)
  const sendMedia = mock().mockResolvedValue({ waMessageId: 'wamid.1' })

  const useCase = new ProcessReceiptJobUseCase({
    idempotencyGuard,
    orderReceiptRepository: {
      findOrderReceiptData,
      markFiscalDocumentId,
    },
    receiptProvider: { generate: receiptProvider },
    emailProvider: { sendReceipt: emailProvider },
    whatsAppSender: { sendMedia },
  })

  return { useCase, idempotencyGuard, findOrderReceiptData, markFiscalDocumentId, receiptProvider, emailProvider, sendMedia }
}

describe('ProcessReceiptJobUseCase', () => {
  test('gera recibo e envia por WhatsApp quando preferencia é whatsapp', async () => {
    const { useCase, idempotencyGuard, receiptProvider, sendMedia, emailProvider } = buildUseCase(ORDER_DATA)

    await useCase.execute({ jobId: 'job-1', orderId: 'order-1' })

    expect(receiptProvider).toHaveBeenCalledTimes(1)
    expect(sendMedia).toHaveBeenCalledTimes(1)
    expect(emailProvider).toHaveBeenCalledTimes(0)
    expect(await idempotencyGuard.wasProcessed('receipt:processed:order-1')).toBe(true)
  })

  test('envia recibo por email quando preferencia é email', async () => {
    const orderData = { ...ORDER_DATA, receiptPreference: 'email' }
    const { useCase, emailProvider, sendMedia } = buildUseCase(orderData)

    await useCase.execute({ jobId: 'job-2', orderId: 'order-1' })

    expect(emailProvider).toHaveBeenCalledTimes(1)
    expect(sendMedia).toHaveBeenCalledTimes(0)
  })

  test('envia recibo por WhatsApp e email quando preferencia é both', async () => {
    const orderData = { ...ORDER_DATA, receiptPreference: 'both' }
    const { useCase, emailProvider, sendMedia } = buildUseCase(orderData)

    await useCase.execute({ jobId: 'job-3', orderId: 'order-1' })

    expect(sendMedia).toHaveBeenCalledTimes(1)
    expect(emailProvider).toHaveBeenCalledTimes(1)
  })

  test('não reprocessa o mesmo pedido (idempotência por orderId)', async () => {
    const { useCase, receiptProvider } = buildUseCase(ORDER_DATA)

    await useCase.execute({ jobId: 'job-4', orderId: 'order-1' })
    await useCase.execute({ jobId: 'job-4-retry', orderId: 'order-1' })

    expect(receiptProvider).toHaveBeenCalledTimes(1)
  })

  test('pedido não encontrado retorna sem erro e não gera recibo', async () => {
    const { useCase, receiptProvider } = buildUseCase(undefined)

    await expect(useCase.execute({ jobId: 'job-5', orderId: 'order-missing' })).resolves.toBeUndefined()
    expect(receiptProvider).toHaveBeenCalledTimes(0)
  })

  test('salva fiscalDocumentId quando provider retorna um', async () => {
    const idempotencyGuard = new FakeIdempotencyGuard()
    const findOrderReceiptData = mock().mockResolvedValue({ ...ORDER_DATA, fiscalDocumentId: null })
    const markFiscalDocumentId = mock().mockResolvedValue(undefined)
    const receiptProvider = mock().mockResolvedValue({ pdf: Buffer.from('pdf'), fiscalDocumentId: 'NFC-e-12345' })
    const emailProvider = mock().mockResolvedValue(undefined)
    const sendMedia = mock().mockResolvedValue({ waMessageId: 'wamid.1' })

    const useCase = new ProcessReceiptJobUseCase({
      idempotencyGuard,
      orderReceiptRepository: { findOrderReceiptData, markFiscalDocumentId },
      receiptProvider: { generate: receiptProvider },
      emailProvider: { sendReceipt: emailProvider },
      whatsAppSender: { sendMedia },
    })

    await useCase.execute({ jobId: 'job-6', orderId: 'order-1' })

    expect(markFiscalDocumentId).toHaveBeenCalledTimes(1)
    expect(markFiscalDocumentId).toHaveBeenCalledWith('order-1', 'NFC-e-12345')
  })

  test('não salva fiscalDocumentId quando provider não retorna um', async () => {
    const { useCase, markFiscalDocumentId } = buildUseCase(ORDER_DATA)

    await useCase.execute({ jobId: 'job-7', orderId: 'order-1' })

    expect(markFiscalDocumentId).toHaveBeenCalledTimes(0)
  })
})
