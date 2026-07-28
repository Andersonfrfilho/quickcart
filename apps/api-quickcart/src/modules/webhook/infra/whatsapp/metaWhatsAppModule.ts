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
import { createTextModerator, parseTermList } from '@adatechnology/text-moderation'
import { createQuickCartObjectStorage } from '@/modules/webhook/infra/storage/objectStorageAdapter'
import { db } from '@/infra/database/connection'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { serializeError } from '@/shared/serializeError'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { ConversationEngine } from '@/modules/conversation/application/ConversationEngine'
import type { FlowDriver } from '@/modules/conversation/application/FlowDriver'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import { parseInboundMessage } from '@/modules/webhook/application/parseInboundMessage'
import { conversationSseHub } from '@/modules/conversation/infra/realtime/conversationRealtime'
import { documentsQueue } from '@/infra/queue/queues'

const webhookLog = logger.child('Webhook')

// Construído uma vez: o moderador compila a regex do dicionário no construtor, e refazer isso a
// cada mensagem seria trabalho repetido em cima do caminho mais quente do webhook.
// `undefined` quando desligado: a ausência fica visível no tipo do provider, em vez de um storage
// que aceita chamada e falha na primeira gravação.
export const quickCartObjectStorage = environment.STORAGE_ENABLED ? createQuickCartObjectStorage() : undefined

const textModerator = createTextModerator({
  isEnabled: environment.MODERATION_ENABLED,
  extraTerms: parseTermList(environment.MODERATION_EXTRA_TERMS),
  allowedTerms: parseTermList(environment.MODERATION_ALLOWED_TERMS),
})

type CreateQuickCartWhatsAppModuleParams = {
  readonly cacheProvider: CacheProvider
  readonly customerRepository: CustomerRepositoryInterface
  // Resolvido preguiçosamente: a engine depende de repositórios que dependem deste módulo,
  // então o container não consegue construir os dois na mesma passada.
  readonly resolveConversationEngine: () => ConversationEngine
  // Também preguiçoso: o driver depende do interpretador que esta própria fábrica cria.
  readonly resolveFlowDriver: () => FlowDriver | undefined
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
    // O grafo dirige a conversa: é dono da saudação, do menu e dos fluxos que o lojista
    // desenhar. Os handlers TS continuam existindo, invocados por nós de ação (ver
    // registerQuickCartFlowActions) para as partes que não cabem num grafo declarativo.
    features: { flowEngine: true },
    // Com o notificador injetado, cada mensagem gravada e cada mudança de status vira evento
    // SSE — é o que faz a inbox se mover sozinha enquanto o atendente olha.
    //
    // O moderador entra pela mesma porta e por isso não é assunto do módulo: quem tem o
    // liga/desliga e a lista de termos é o produto, via ambiente validado. Desligado, o módulo
    // grava as colunas nulas ("não avaliado") em vez de fingir que verificou.
    providers: {
      realtime: conversationSseHub,
      moderator: textModerator,
      // Sem storage o módulo não expõe `ingestInboundMedia` — o tipo fica `undefined` em vez de
      // devolver um use case que falharia em runtime.
      ...(quickCartObjectStorage ? { objectStorage: quickCartObjectStorage.forModule } : {}),
    },
    hooks: {
      // Enfileira em vez de baixar aqui: a Meta reenvia o webhook se não receber 200 a tempo, e
      // copiar o binário é I/O de rede que não cabe no caminho da resposta. `jobId` derivado da
      // mídia deixa a fila descartar reentrega antes de rodar — o use case também é idempotente,
      // mas descartar mais cedo é mais barato.
      onMediaReceived: async (media) => {
        if (!quickCartObjectStorage) return

        // `_` como separador, não `:`: o BullMQ recusa jobId com dois-pontos ("Custom Id cannot
        // contain :"), e companyId é UUID — que tem `-` mas nunca `_`, então a chave segue sem
        // ambiguidade.
        await documentsQueue.add(
          'ingest-inbound-media',
          media,
          { jobId: `${media.companyId}_${media.sourceMediaId}` },
        )
      },

      onMessageReceived: async (message, session) => {
        // O cliente precisa existir antes da engine rodar — ela desiste com
        // conversation_customer_not_found se não achar. O módulo cuida da sessão, mas
        // `customers` é tabela do QuickCart e ele não a conhece; este upsert é a metade da
        // antiga ReceiveWhatsAppWebhook que continua sendo regra de negócio daqui.
        // Aguardado (a sessão já foi gravada pelo módulo, então isto é rápido e local).
        await params.customerRepository.upsertByPhone({ phone: message.from })

        // Deliberadamente NÃO aguardado: a Meta reenvia o webhook se não receber 200 a tempo,
        // e tanto o grafo quanto a engine fazem I/O longo (LLM, catálogo, carrinho).
        void (async () => {
          const parsed = parseInboundMessage(message)
          const driver = params.resolveFlowDriver()

          // O grafo tem a primeira palavra. Ele devolve false quando não havia fluxo para
          // atender, e aí a engine assume — que é o caso de quem já está no meio de um
          // carrinho ou checkout, fora do grafo.
          if (driver && session.flowKey !== null) {
            if (await driver.handleInbound({ session, message: parsed })) return
          }
          if (driver && session.currentState === CONVERSATION_STATE.GREETING) {
            if (await driver.handleInbound({ session, message: parsed })) return
          }

          await params.resolveConversationEngine().handle(parsed)
        })().catch((error: unknown) => {
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
