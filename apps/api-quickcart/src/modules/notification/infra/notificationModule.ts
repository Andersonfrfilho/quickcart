/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Toda a integração com o `@adatechnology/notification-module`: as duas portas que só o host pode
 * responder, mais a composição. Inbox, push, e-mail e WhatsApp — schema, rotas, worker, retry e
 * supressão vêm do pacote.
 */

import { createNotificationModule } from '@adatechnology/notification-module'
import type { NotificationModule } from '@adatechnology/notification-module'
import { createBullMqQueue } from '@adatechnology/notification-module/queue/bullmq'
import type { AuthContextResolverPort } from '@adatechnology/module-http'
import type { RecipientResolverPort, ChannelDrivers } from '@adatechnology/notification-contracts'
import { eq } from 'drizzle-orm'

import { db } from '@/infra/database/connection'
import { customers } from '@/infra/database/schema/customers'
import { environment } from '@/infra/config/environment'
import { notificationDeliveryQueue } from '@/infra/queue/queues'

const BEARER_PREFIX = 'Bearer '

/**
 * O módulo não valida token: recebe identidade pronta (`security.md` §2). O quickcart tem só o
 * Bearer estático de admin nesta fase, então quem passa por aqui é o operador — e o escopo `admin`
 * é o que as rotas de template e de envio exigem.
 */
const authContextResolver: AuthContextResolverPort = {
  async resolve({ headers }) {
    const header = headers['authorization']
    const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined
    if (!token || token !== environment.ADMIN_API_TOKEN) return undefined

    return { companyId: environment.WHATSAPP_COMPANY_ID, userId: 'admin', scopes: ['admin'] }
  },
}

/** O módulo não conhece a tabela de clientes do host — é a razão desta porta existir. */
const recipientResolver: RecipientResolverPort = {
  async resolve({ userId }) {
    const [customer] = await db
      .select({ phone: customers.phone, email: customers.email })
      .from(customers)
      .where(eq(customers.id, userId))
      .limit(1)

    if (!customer) return undefined
    // `exactOptionalPropertyTypes`: a chave é omitida quando não há e-mail, em vez de existir com
    // `undefined` — a diferença é o que faz o fan-out não planejar um envio para lugar nenhum.
    return customer.email ? { phone: customer.phone, email: customer.email } : { phone: customer.phone }
  },
}

export function createQuickCartNotificationModule(params: { channels: ChannelDrivers }): NotificationModule {
  return createNotificationModule({
    db,
    config: {
      defaultLocale: 'pt-BR',
      defaultTimezone: 'America/Sao_Paulo',
      suppressionHmacKey: environment.NOTIFICATION_SUPPRESSION_KEY,
    },
    providers: {
      recipientResolver,
      authContextResolver,
      channels: params.channels,
      // Sem isto o módulo cai na fila em processo, e a entrega nunca sai da API — o worker
      // ficaria de pé sem nada para consumir, e o sintoma seria "notificação não chega".
      queue: createBullMqQueue({ queue: notificationDeliveryQueue }),
    },
  })
}
