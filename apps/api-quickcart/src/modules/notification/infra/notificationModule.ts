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

import { withBullMqSafeJobId } from './bullMqJobIdSafeQueue'

const BEARER_PREFIX = 'Bearer '

/**
 * Identidade do operador, como UUID fixo.
 *
 * O quickcart não tem tabela de usuários de painel nesta fase — a autenticação do admin é um Bearer
 * estático, então não existe id de usuário real a devolver. A primeira versão disto devolvia
 * `userId: 'admin'`, e o efeito só apareceu com a api de pé: `recipientUserId` é UUID no contrato,
 * então enviar dava 400 e o contador de não lidas dava 500 ao comparar a coluna `uuid` com a string
 * `'admin'`. Nem o typecheck nem o E2E pegaram — o E2E usa cliente de verdade.
 *
 * Sentinela e não `randomUUID()`: precisa ser estável entre reinícios, senão a inbox do operador
 * troca de dono a cada deploy. Quando houver usuários de painel, isto vira o id deles.
 */
const ADMIN_OPERATOR_USER_ID = '00000000-0000-4000-8000-0000000000ad'

/**
 * O módulo não valida token: recebe identidade pronta (`security.md` §2). O quickcart tem só o
 * Bearer estático de admin nesta fase, então quem passa por aqui é o operador — e o escopo `admin`
 * é o que as rotas de template e de envio exigem.
 */
export const notificationAuthContextResolver: AuthContextResolverPort = {
  async resolve({ headers }) {
    const header = headers['authorization']
    const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined
    if (!token || token !== environment.ADMIN_API_TOKEN) return undefined

    return { companyId: environment.WHATSAPP_COMPANY_ID, userId: ADMIN_OPERATOR_USER_ID, scopes: ['admin'] }
  },
}

/**
 * O módulo não conhece a tabela de clientes do host — é a razão desta porta existir.
 *
 * `undefined` significa "não sei quem é" e o módulo recusa o envio, o que é correto. Já o operador é
 * CONHECIDO e simplesmente não tem telefone nem e-mail: devolver objeto vazio é o que diz isso, e é
 * o que permite a inbox dele funcionar. Devolvendo `undefined` aqui, todo aviso ao operador morria
 * com 422 — descobri com a api de pé, tentando popular a tela.
 */
const recipientResolver: RecipientResolverPort = {
  async resolve({ userId }) {
    if (userId === ADMIN_OPERATOR_USER_ID) return { displayName: 'Operador', locale: 'pt-BR' }

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
      authContextResolver: notificationAuthContextResolver,
      channels: params.channels,
      // Sem isto o módulo cai na fila em processo, e a entrega nunca sai da API — o worker
      // ficaria de pé sem nada para consumir, e o sintoma seria "notificação não chega".
      // `withBullMqSafeJobId` é remendo com data de saída — ver o cabeçalho do arquivo.
      queue: createBullMqQueue({ queue: withBullMqSafeJobId(notificationDeliveryQueue) }),
    },
  })
}
