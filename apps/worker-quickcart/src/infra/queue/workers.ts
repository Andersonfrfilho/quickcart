import { Worker } from 'bullmq'
import { queueConnection } from '@/infra/queue/connection'
import { QUEUE_NAMES } from '@/infra/queue/queues.constant'
import { processSttJob } from '@/modules/stt/infra/processors/SttProcessor'
import { processNotificationJob } from '@/modules/notification/infra/processors/NotificationProcessor'
import { processReceiptJob } from '@/modules/receipt/infra/processors/ReceiptProcessor'
import { logger } from '@/shared/logger'

const workersLog = logger.child('Workers')

export function startWorkers(): Worker[] {
  const sttWorker = new Worker(QUEUE_NAMES.STT, processSttJob, { connection: queueConnection })
  const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATION, processNotificationJob, { connection: queueConnection })
  const receiptWorker = new Worker(QUEUE_NAMES.RECEIPT, processReceiptJob, { connection: queueConnection })

  sttWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.STT }))
  notificationWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.NOTIFICATION }))
  receiptWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.RECEIPT }))

  sttWorker.on('failed', (job, error) => workersLog.error('job_failed', { queue: QUEUE_NAMES.STT, jobId: job?.id, error: String(error) }))
  notificationWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.NOTIFICATION, jobId: job?.id, error: String(error) }),
  )
  receiptWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.RECEIPT, jobId: job?.id, error: String(error) }),
  )

  return [sttWorker, notificationWorker, receiptWorker]
}
