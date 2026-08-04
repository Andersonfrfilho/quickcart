/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A instância do módulo que o worker usa para DESPACHAR o que a API enfileirou.
 *
 * Duas instâncias do mesmo módulo, uma por processo, é o desenho: cada uma abre a própria conexão
 * de banco e conhece os próprios canais. A API cria a notificação e enfileira; o worker despacha.
 * Compartilhar instância exigiria compartilhar processo.
 *
 * O `authContextResolver` fica de fora aqui de propósito — o worker não serve HTTP, e injetar um
 * resolvedor de identidade num processo sem requisição seria dependência que ninguém exercita.
 */

import { createNotificationModule } from '@adatechnology/notification-module'
import type { NotificationModule } from '@adatechnology/notification-module'
import { createWhatsAppDriverFromChannel } from '@adatechnology/notification-contracts'
import type {
  ChannelDrivers,
  RecipientResolverPort,
  WhatsAppSendingChannel,
} from '@adatechnology/notification-contracts'
import { eq } from 'drizzle-orm'

import { db } from '@/infra/database/connection'
import { customers } from '@/infra/database/schema/customers'
import { environment } from '@/infra/config/environment'
import { whatsAppProvider } from '@/infra/whatsapp/provider'

const recipientResolver: RecipientResolverPort = {
  async resolve({ userId }) {
    const [customer] = await db
      .select({ phone: customers.phone, email: customers.email })
      .from(customers)
      .where(eq(customers.id, userId))
      .limit(1)

    if (!customer) return undefined
    // `exactOptionalPropertyTypes`: chave omitida em vez de `undefined`, senão o fan-out planeja
    // um envio de e-mail para endereço nenhum.
    return customer.email ? { phone: customer.phone, email: customer.email } : { phone: customer.phone }
  },
}

/**
 * O provider da Meta devolve `waMessageId`; o contracts fala `externalMessageId`. Nomes diferentes
 * para a mesma coisa, e a tradução mora aqui: renomear no provider quebraria os outros consumidores
 * dele, e o contracts não deve conhecer o vocabulário de um fornecedor.
 */
function asSendingChannel(provider: NonNullable<typeof whatsAppProvider>): WhatsAppSendingChannel {
  return {
    async sendText(to, body) {
      const { waMessageId } = await provider.messages.sendText(to, body)
      return { externalMessageId: waMessageId }
    },
    async sendTemplate(params) {
      const { waMessageId } = await provider.messages.sendTemplate(params)
      return { externalMessageId: waMessageId }
    },
  }
}

function buildChannels(): ChannelDrivers {
  // WhatsApp desconfigurado é estado real em desenvolvimento. Sem o canal, o fan-out simplesmente
  // não planeja esse destino — melhor que subir o worker com um driver que falha em toda tentativa.
  if (!whatsAppProvider) return {}
  return { whatsapp: createWhatsAppDriverFromChannel(asSendingChannel(whatsAppProvider)) }
}

export function createWorkerNotificationModule(): NotificationModule {
  return createNotificationModule({
    db,
    config: {
      defaultLocale: 'pt-BR',
      defaultTimezone: 'America/Sao_Paulo',
      suppressionHmacKey: environment.NOTIFICATION_SUPPRESSION_KEY,
    },
    providers: { recipientResolver, channels: buildChannels() },
  })
}
