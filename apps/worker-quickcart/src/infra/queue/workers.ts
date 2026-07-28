import { Worker } from 'bullmq'
import { queueConnection } from '@/infra/queue/connection'
import { QUEUE_NAMES } from '@/infra/queue/queues.constant'
import { processSttJob } from '@/modules/stt/infra/processors/SttProcessor'
import { processNotificationJob } from '@/modules/notification/infra/processors/NotificationProcessor'
import { processReceiptJob } from '@/modules/receipt/infra/processors/ReceiptProcessor'
import { processDocumentsJob, PURGE_EXPIRED_JOB } from '@/modules/documents/infra/processors/DocumentsProcessor'
import { Queue } from 'bullmq'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'

const workersLog = logger.child('Workers')

export function startWorkers(): Worker[] {
  const sttWorker = new Worker(QUEUE_NAMES.STT, processSttJob, { connection: queueConnection })
  const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATION, processNotificationJob, { connection: queueConnection })
  const receiptWorker = new Worker(QUEUE_NAMES.RECEIPT, processReceiptJob, { connection: queueConnection })
  const documentsWorker = new Worker(QUEUE_NAMES.DOCUMENTS, processDocumentsJob, { connection: queueConnection })

  sttWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.STT }))
  notificationWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.NOTIFICATION }))
  receiptWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.RECEIPT }))
  documentsWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.DOCUMENTS }))

  sttWorker.on('failed', (job, error) => workersLog.error('job_failed', { queue: QUEUE_NAMES.STT, jobId: job?.id, error: String(error) }))
  notificationWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.NOTIFICATION, jobId: job?.id, error: String(error) }),
  )
  receiptWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.RECEIPT, jobId: job?.id, error: String(error) }),
  )

  documentsWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.DOCUMENTS, jobId: job?.id, error: String(error) }),
  )

  // Varredura de retenção como job repetível na mesma fila. Agendado no boot, e não por cron
  // externo, para o worker ser a única coisa que precisa estar de pé. `jobId` fixo faz o BullMQ
  // substituir o agendamento em vez de acumular um por reinício do processo.
  if (environment.DOCUMENTS_RETENTION_DAYS > 0) {
    const documentsQueue = new Queue(QUEUE_NAMES.DOCUMENTS, { connection: queueConnection })
    void documentsQueue
      .add(
        PURGE_EXPIRED_JOB,
        {},
        {
          jobId: PURGE_EXPIRED_JOB,
          repeat: { every: environment.DOCUMENTS_RETENTION_SWEEP_HOURS * 60 * 60 * 1000 },
          removeOnComplete: { count: 20 },
        },
      )
      .then(() =>
        workersLog.info('retention_scheduled', {
          everyHours: environment.DOCUMENTS_RETENTION_SWEEP_HOURS,
          retentionDays: environment.DOCUMENTS_RETENTION_DAYS,
        }),
      )
      .catch((error: unknown) => workersLog.error('retention_schedule_failed', { error: String(error) }))
  }

  return [sttWorker, notificationWorker, receiptWorker, documentsWorker]
}
