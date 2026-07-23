import type { Job } from 'bullmq'
import { markProcessed, wasProcessed } from '@/infra/queue/JobIdempotencyGuard'
import { whatsAppProvider } from '@/infra/whatsapp/provider'
import { createReceiptProvider } from '@/modules/receipt/infra/providers/createReceiptProvider'
import { NodemailerEmailProvider } from '@/modules/receipt/infra/providers/EmailProvider'
import { DrizzleOrderReceiptRepository } from '@/modules/receipt/infra/repositories/DrizzleOrderReceiptRepository'
import { ProcessReceiptJobUseCase } from '@/modules/receipt/application/use-cases/ProcessReceiptJob.use-case'
import type { ProcessReceiptJobParams } from '@/modules/receipt/application/types/ProcessReceiptJob.types'
import { logger } from '@/shared/logger'

const receiptLog = logger.child('ReceiptProcessor')

const receiptProvider = createReceiptProvider()
const emailProvider = new NodemailerEmailProvider()
const orderReceiptRepository = new DrizzleOrderReceiptRepository()

const whatsAppSender = {
  sendMedia: async (to: string, pdf: Buffer, caption: string) => {
    await whatsAppProvider?.messages.sendMedia({
      to,
      buffer: pdf,
      mimeType: 'application/pdf',
      filename: 'recibo.pdf',
      caption,
    })
  },
}

export type ReceiptJobData = {
  readonly orderId: string
}

function useCaseFactory() {
  return new ProcessReceiptJobUseCase({
    idempotencyGuard: { wasProcessed, markProcessed },
    orderReceiptRepository,
    receiptProvider,
    emailProvider,
    whatsAppSender,
  })
}

export async function processReceiptJob(job: Job<ReceiptJobData>): Promise<void> {
  receiptLog.info('receipt_job_started', { jobId: job.id, orderId: job.data.orderId })
  await useCaseFactory().execute({ jobId: job.id!, orderId: job.data.orderId })
}
