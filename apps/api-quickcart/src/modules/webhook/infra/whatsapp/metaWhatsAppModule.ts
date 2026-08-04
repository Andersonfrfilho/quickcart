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
import { createQuickCartTranscriber } from '@/modules/webhook/infra/transcription/transcriberAdapter'
import { db } from '@/infra/database/connection'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { serializeError } from '@/shared/serializeError'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { ConversationEngine } from '@/modules/conversation/application/ConversationEngine'
import type { FlowDriver } from '@/modules/conversation/application/FlowDriver'
import type { ResolveInboundAudio } from '@/modules/conversation/application/resolveInboundAudio'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import { parseInboundMessage } from '@/modules/webhook/application/parseInboundMessage'
import { conversationSseHub } from '@/modules/conversation/infra/realtime/conversationRealtime'
import { documentsQueue } from '@/infra/queue/queues'
import { DEFAULT_TRANSCRIPTION_RETRY_SECONDS, DOCUMENTS_JOBS } from '@/infra/queue/queues.constant'

const webhookLog = logger.child('Webhook')

/**
 * Chave do job de ingestão, derivada da mídia para a fila descartar reentrega antes de rodar.
 *
 * O BullMQ recusa `:` em jobId ("Custom Id cannot contain :"), e o id de mídia do simulador de
 * conversa é prefixado justamente com `preview-upload:` — o que derrubava o webhook inteiro com um
 * erro que não mencionava fila nem prefixo. Sanitizar tudo que não é seguro, em vez de só escolher o
 * separador, é o que impede o próximo formato de id de repetir a surpresa.
 *
 * `_` como separador porque companyId é UUID: tem `-`, nunca `_`, então a chave segue sem ambiguidade.
 */
function mediaJobId(companyId: string, sourceMediaId: string): string {
  return `${companyId}_${sourceMediaId.replace(/[^A-Za-z0-9_-]/g, '_')}`
}

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

/**
 * `undefined` quando desligado ou sem chave: o módulo não expõe `transcribeAudio`, e o painel deixa
 * de desenhar o botão em vez de oferecer uma ação que estoura no clique.
 *
 * Exportado porque o `FlowDriver` usa a MESMA instância para o grafo entender nota de voz — duas
 * instâncias significariam duas configurações capazes de divergir sem ninguém notar.
 */
export const audioTranscriber = createQuickCartTranscriber()

type CreateQuickCartWhatsAppModuleParams = {
  readonly cacheProvider: CacheProvider
  readonly customerRepository: CustomerRepositoryInterface
  // Resolvido preguiçosamente: a engine depende de repositórios que dependem deste módulo,
  // então o container não consegue construir os dois na mesma passada.
  readonly resolveConversationEngine: () => ConversationEngine
  // Também preguiçoso: o driver depende do interpretador que esta própria fábrica cria.
  readonly resolveFlowDriver: () => FlowDriver | undefined
  /**
   * Troca nota de voz por texto antes de decidir quem atende.
   *
   * Fica ANTES do roteamento porque foi a alternativa a cada caminho aprender a ouvir por conta
   * própria — o que na prática significou grafo e lista ouvindo, e todo o resto respondendo
   * "escolha uma opção" para quem falava.
   */
  readonly resolveInboundAudio: () => ResolveInboundAudio | undefined
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
    // `previewMedia` só em dev: ligado, o canal aceita id que não veio da Meta e lê o objeto
    // correspondente do storage — recurso no simulador, leitura arbitrária em produção. A mesma flag
    // que libera a leitura do transcript pelo preview governa isto.
    features: { flowEngine: true, previewMedia: environment.PREVIEW_TRANSCRIPT_ENABLED },
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
      // O modo vem do ambiente porque é decisão de operação, não default técnico: `auto` transcreve
      // toda nota de voz recebida (gasta cota por áudio que talvez ninguém leia), `onDemand` só
      // quando o atendente clica.
      ...(audioTranscriber
        ? {
            transcription: {
              transcriber: audioTranscriber,
              mode: environment.TRANSCRIPTION_MODE,
              languageHint: environment.TRANSCRIPTION_LANGUAGE,
            },
          }
        : {}),
    },
    hooks: {
      // Enfileira em vez de baixar aqui: a Meta reenvia o webhook se não receber 200 a tempo, e
      // copiar o binário é I/O de rede que não cabe no caminho da resposta. `jobId` derivado da
      // mídia deixa a fila descartar reentrega antes de rodar — o use case também é idempotente,
      // mas descartar mais cedo é mais barato.
      onMediaReceived: async (media) => {
        if (!quickCartObjectStorage) return

        await documentsQueue.add(DOCUMENTS_JOBS.INGEST_INBOUND_MEDIA, media, {
          jobId: mediaJobId(media.companyId, media.sourceMediaId),
        })
      },

      /**
       * Transcrição estourou cota (ou falhou de forma transitória) — reenfileira com atraso.
       *
       * É esta a rede de segurança do rate limit: bater o teto do engine não significa "não
       * consigo transcrever", significa "não consigo AGORA". O áudio já está no storage, o status
       * ficou `pending`, e o job volta respeitando o `Retry-After` que o engine informou.
       *
       * Enfileira um job de TRANSCRIÇÃO, não uma segunda ingestão: o binário está salvo, e
       * rebaixá-lo da Meta gastaria banda para repetir um efeito que já aconteceu.
       */
      onTranscriptionDeferred: async (details) => {
        const delayMs = (details.retryAfterSeconds ?? DEFAULT_TRANSCRIPTION_RETRY_SECONDS) * 1000

        webhookLog.warn(LOG_EVENTS.TRANSCRIPTION_DEFERRED, {
          messageId: details.messageId,
          reason: details.reason,
          delayMs,
          error: serializeError(details.error),
        })

        try {
          // `jobId` derivado da mensagem: várias tentativas do mesmo áudio colapsam num job só, em
          // vez de acumularem retentativas concorrentes brigando pela mesma cota já estourada.
          await documentsQueue.add(
            DOCUMENTS_JOBS.TRANSCRIBE_AUDIO,
            { companyId: details.companyId, messageId: details.messageId },
            { jobId: `transcribe_${details.companyId}_${details.messageId}`, delay: delayMs },
          )
        } catch (error: unknown) {
          // Não propaga: quem chamou este hook foi a ingestão, e o binário já está salvo. Falhar
          // aqui faria o job de mídia inteiro entrar em retry e rebaixar o arquivo da Meta.
          webhookLog.error(LOG_EVENTS.TRANSCRIPTION_DEFER_ENQUEUE_FAILED, {
            messageId: details.messageId,
            error: serializeError(error),
          })
        }
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
          const resolveAudio = params.resolveInboundAudio()
          const inbound = parseInboundMessage(message)
          // Uma transcrição por mensagem, aqui: quem atende recebe texto e não precisa saber que
          // houve áudio. Falha ou silêncio devolve o áudio original, e o caminho antigo segue valendo.
          const parsed = resolveAudio
            ? await resolveAudio({ message: inbound, whatsappNumber: message.from })
            : inbound
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
