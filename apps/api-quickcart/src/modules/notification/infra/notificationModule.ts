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
import {
  extractBearerToken,
  isKnownRole,
  resolveScopesForRole,
} from '@/modules/user/infra/userAuthContextResolver'
import { getQuickCartUserModule } from '@/modules/user/infra/userModule'

const DEFAULT_LOCALE = 'pt-BR'
import { customers } from '@/infra/database/schema/customers'
import { environment } from '@/infra/config/environment'
import { notificationDeliveryQueue } from '@/infra/queue/queues'

import { withBullMqSafeJobId } from './bullMqJobIdSafeQueue'

/**
 * Identidade do operador, agora vinda da SESSÃO — não mais um sentinela.
 *
 * A versão anterior devolvia um UUID fixo (`00000000-…-ad`) porque o quickcart não tinha tabela de
 * usuários e a autorização era um Bearer estático: não havia id de pessoa a devolver. O comentário
 * dizia "quando houver usuários de painel, isto vira o id deles" — é o que acontece aqui.
 *
 * O efeito prático é o que o sentinela não podia dar: a inbox passa a ser de cada operador, e não
 * uma caixa única compartilhada por quem tivesse o token.
 */
export const notificationAuthContextResolver: AuthContextResolverPort = {
  async resolve({ headers }) {
    const accessToken = extractBearerToken(headers['authorization'])
    if (!accessToken) return undefined

    const userModule = await getQuickCartUserModule()
    const claims = await userModule.verifyAccessToken(accessToken)
    if (!claims || !isKnownRole(claims.role)) return undefined

    return {
      companyId: environment.WHATSAPP_COMPANY_ID,
      userId: claims.sub,
      scopes: resolveScopesForRole(claims.role),
    }
  },
}

/**
 * O módulo não conhece nem a tabela de clientes nem a de usuários do host — é a razão desta porta
 * existir. Os dois públicos do QuickCart recebem aviso: o cliente pelo WhatsApp, e o operador pela
 * inbox do painel.
 *
 * Operador primeiro porque o id de sessão é o caso comum de quem chega por rota autenticada. Ele é
 * CONHECIDO e simplesmente pode não ter telefone: devolver o objeto sem `phone` é o que diz isso, e
 * é o que permite a inbox funcionar. Devolvendo `undefined` aqui, todo aviso ao operador morria com
 * 422 — foi assim que apareceu, com a api de pé.
 *
 * `undefined` fica reservado a "não sei quem é", e aí o módulo recusa o envio, o que é correto.
 */
const recipientResolver: RecipientResolverPort = {
  async resolve({ userId }) {
      const staff = await findStaffRecipient({ userId })
      if (staff) return staff

      const [customer] = await db
        .select({ phone: customers.phone, email: customers.email })
        .from(customers)
        .where(eq(customers.id, userId))
        .limit(1)

      if (!customer) return undefined
      return customer.email ? { phone: customer.phone, email: customer.email } : { phone: customer.phone }
  },
}

/** Catch local de fallback gracioso: "não é usuário de painel" é resposta, não falha. */
async function findStaffRecipient(params: { userId: string }) {
  try {
    const userModule = await getQuickCartUserModule()
    const profile = await userModule.useCases.getProfile.execute({ id: params.userId })
    return { displayName: profile.name, email: profile.email, locale: DEFAULT_LOCALE }
  } catch {
    return undefined
  }
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
