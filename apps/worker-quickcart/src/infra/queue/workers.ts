import { Worker } from 'bullmq'
import { queueConnection } from '@/infra/queue/connection'
import { QUEUE_NAMES } from '@/infra/queue/queues.constant'
import { processSttJob } from '@/modules/stt/infra/processors/SttProcessor'
import { createNotificationWorker } from '@adatechnology/notification-module'
import { createBullMqQueue } from '@adatechnology/notification-module/queue/bullmq'
import { createWorkerNotificationModule } from '@/modules/notification/notificationModule'
import { processReceiptJob } from '@/modules/receipt/infra/processors/ReceiptProcessor'
import { processDocumentsJob, PURGE_EXPIRED_JOB } from '@/modules/documents/infra/processors/DocumentsProcessor'
import { processOrderDecisionJob } from '@/modules/order/infra/processors/OrderDecisionProcessor'
import { Queue } from 'bullmq'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'

const workersLog = logger.child('Workers')

export function startWorkers(): Worker[] {
  const sttWorker = new Worker(QUEUE_NAMES.STT, processSttJob, { connection: queueConnection })
  const receiptWorker = new Worker(QUEUE_NAMES.RECEIPT, processReceiptJob, { connection: queueConnection })
  const documentsWorker = new Worker(QUEUE_NAMES.DOCUMENTS, processDocumentsJob, { connection: queueConnection })
  const orderDecisionWorker = new Worker(QUEUE_NAMES.ORDER_DECISION, processOrderDecisionJob, {
    connection: queueConnection,
  })

  sttWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.STT }))
  receiptWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.RECEIPT }))
  documentsWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.DOCUMENTS }))
  orderDecisionWorker.on('ready', () => workersLog.info('worker_ready', { queue: QUEUE_NAMES.ORDER_DECISION }))

  sttWorker.on('failed', (job, error) => workersLog.error('job_failed', { queue: QUEUE_NAMES.STT, jobId: job?.id, error: String(error) }))
  receiptWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.RECEIPT, jobId: job?.id, error: String(error) }),
  )

  documentsWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.DOCUMENTS, jobId: job?.id, error: String(error) }),
  )

  orderDecisionWorker.on('failed', (job, error) =>
    workersLog.error('job_failed', { queue: QUEUE_NAMES.ORDER_DECISION, jobId: job?.id, error: String(error) }),
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

  // Notificação em fila PRÓPRIA (`QUEUE_NAMES.NOTIFICATION_DELIVERY`), e não na `notification`
  // antiga: o job do SDK tem outro formato (`{ notificationId, deliveryId, channel, attempt }`
  // contra `{ orderId, status }`). Reaproveitar o nome faria o worker novo receber job antigo
  // ainda na fila durante o deploy, e falhar em cima de dado que ele não sabe ler.
  const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION_DELIVERY, { connection: queueConnection })
  // `createWorker` é fábrica, não instância: o módulo constrói o Worker com o handler DELE, e a
  // conexão continua sendo do host — o pacote não abre conexão própria.
  let notificationWorker: Worker | undefined
  const notificationQueuePort = createBullMqQueue({
    queue: notificationQueue,
    createWorker: (handler) => {
      notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATION_DELIVERY, async (job) => handler(job.data), {
        connection: queueConnection,
      })
      return notificationWorker
    },
  })
  void createNotificationWorker({
    module: createWorkerNotificationModule(),
    queue: notificationQueuePort,
    logger: workersLog,
  }).start()

  notificationWorker?.on('ready', () =>
    workersLog.info('worker_ready', { queue: QUEUE_NAMES.NOTIFICATION_DELIVERY }),
  )

  return [
    sttWorker,
    receiptWorker,
    documentsWorker,
    orderDecisionWorker,
    ...(notificationWorker ? [notificationWorker] : []),
  ]
}
