/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Instância única do @adatechnology/meta-whatsapp-module. O módulo cuida do canal
 * (verificação, assinatura, anti-replay, persistência de sessão/mensagem); a conversa em si
 * continua sendo dirigida pelo ConversationEngine daqui, plugado no hook onMessageReceived.
 */

import { createMetaWhatsAppModule, type MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import type { NonceStoreInterface } from '@adatechnology/meta-whatsapp-module'
import { db } from '@/infra/database/connection'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { serializeError } from '@/shared/serializeError'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { ConversationEngine } from '@/modules/conversation/application/ConversationEngine'
import { parseInboundMessage } from '@/modules/webhook/application/parseInboundMessage'

const webhookLog = logger.child('Webhook')

type CreateQuickCartWhatsAppModuleParams = {
  readonly cacheProvider: CacheProvider
  // Resolvido preguiçosamente: a engine depende de repositórios que dependem deste módulo,
  // então o container não consegue construir os dois na mesma passada.
  readonly resolveConversationEngine: () => ConversationEngine
}

// O anti-replay do módulo precisa de um SET NX atômico compartilhado entre instâncias.
// O CacheProvider do QuickCart já é Redis; aqui só o formato do contrato muda.
function toNonceStore(cacheProvider: CacheProvider): NonceStoreInterface {
  return {
    async setIfAbsent(key: string, ttlSeconds: number): Promise<boolean> {
      return cacheProvider.setIfNotExists(key, '1', ttlSeconds)
    },
  }
}

export function createQuickCartWhatsAppModule(params: CreateQuickCartWhatsAppModuleParams): MetaWhatsAppModule {
  return createMetaWhatsAppModule({
    db,
    config: {
      phoneNumberId: environment.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: environment.WHATSAPP_ACCESS_TOKEN,
      webhookVerifyToken: environment.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: environment.WHATSAPP_APP_SECRET,
      wabaId: environment.WHATSAPP_BUSINESS_ACCOUNT_ID,
      apiVersion: environment.WHATSAPP_API_VERSION,
      baseUrl: environment.WHATSAPP_BASE_URL,
    },
    nonceStore: toNonceStore(params.cacheProvider),
    startState: CONVERSATION_STATE.GREETING,
    // A conversa do QuickCart é código TypeScript (ConversationEngine + handlers por estado),
    // não um grafo editável. Sem esta flag o módulo instanciaria um interpretador que ninguém
    // chama e o exporia na API pública.
    features: { flowEngine: false },
    hooks: {
      onMessageReceived: async (message) => {
        // Deliberadamente NÃO aguardado: a Meta reenvia o webhook se não receber 200 a tempo,
        // e a engine faz I/O longo (LLM, catálogo, carrinho). Mesma escolha de antes da
        // migração — o que muda é só quem chama.
        void params
          .resolveConversationEngine()
          .handle(parseInboundMessage(message))
          .catch((error: unknown) => {
            webhookLog.error(LOG_EVENTS.CONVERSATION_ENGINE_FAILED, {
              waMessageId: message.id,
              error: serializeError(error),
            })
          })

        // 'handled': o QuickCart assume a mensagem. Devolver 'continue' pediria ao módulo que
        // seguisse para o motor de fluxo, que aqui está desligado.
        return { outcome: 'handled' as const }
      },
    },
  })
}
