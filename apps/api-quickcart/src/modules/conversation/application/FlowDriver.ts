/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Põe o grafo no comando da conversa.
 *
 * A divisão é deliberada: o grafo decide o próximo passo e é dono da saudação, do menu e de
 * qualquer fluxo que o lojista desenhar no editor — coisas que mudam por decisão comercial e
 * não deveriam exigir deploy. As partes pesadas (casar produto por LLM, montar carrinho,
 * fechar pedido) continuam em TypeScript e são invocadas pelo grafo como ações registradas.
 *
 * Tentar expressar carrinho e checkout como nós de um grafo declarativo é onde esta abordagem
 * costuma quebrar: são ~1.200 linhas de aritmética e regra de estoque que não cabem em
 * pergunta/opção/condição. Como ação, o grafo continua no comando de QUANDO elas rodam.
 */

import type { FlowGraphData, FlowActionHandler, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import type { FlowInterpreter, LogMessageUseCase, MessageRepository, SessionRepository } from '@adatechnology/meta-whatsapp-module'
import { TRANSCRIPTION_STATUS } from '@adatechnology/meta-whatsapp-module'
import { logger } from '@/shared/logger'
import { environment } from '@/infra/config/environment'
import type { ChannelAdapterInterface, ConversationSession as ModuleSession } from '@adatechnology/meta-whatsapp-contracts'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import type { AudioTranscriber } from '@adatechnology/audio-transcription-provider'
import { serializeError } from '@/shared/serializeError'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { matchChoiceOption } from '@/modules/conversation/application/matchChoiceOption'
import { shouldYieldToShoppingList } from '@/modules/conversation/application/shouldYieldToShoppingList'
import { looksLikeShoppingList } from '@/modules/conversation/application/looksLikeShoppingList'
import { wrapChannelWithLogging } from '@/modules/conversation/application/wrapChannelWithLogging'

const flowLog = logger.child('FlowDriver')
const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

/**
 * Quanto esperar antes de avisar que estamos ouvindo o áudio.
 *
 * Groq turbo mais a busca da mídia na Meta fica na casa de 2-3s, e silêncio curto no WhatsApp não
 * assusta ninguém. Avisar sempre dobraria as mensagens do bot no transcript; avisar só quando passa
 * daqui dá o retorno exatamente quando a espera começa a parecer travamento.
 */
const AUDIO_NOTICE_AFTER_MS = 2_000

// Fluxo que atende quem chega sem conversa em andamento. É um registro no banco, editável pelo
// lojista — a constante aqui é só a chave usada para encontrá-lo.
export const MAIN_FLOW_KEY = 'main'

export type FlowDriverDependencies = {
  readonly interpreter: FlowInterpreter
  readonly sessionRepository: SessionRepository
  readonly channel: ChannelAdapterInterface
  readonly logMessage: LogMessageUseCase
  readonly startState: string
  readonly loadFlow: (key: string) => Promise<FlowGraphData | undefined>
  /**
   * Esconde opções que não servem para ESTE cliente antes de desenhar a lista.
   *
   * Oferecer "repetir minha última compra" a quem nunca comprou é prometer o que não existe: o cliente
   * toca, ouve que não há pedido anterior e aprende que o menu mente. Filtrar na hora de exibir é o
   * que mantém a promessa — e não pode ser resolvido no grafo, porque o lojista edita o grafo sem
   * saber quem vai receber a mensagem.
   *
   * Ausente, todas as opções aparecem, que é o comportamento de antes. O filtro NÃO mexe no
   * roteamento: `next.byAnswer` continua com todas, então um toque em lista antiga (ou a mesma
   * intenção dita por voz) ainda chega no lugar certo, com a ação respondendo o que for verdade.
   */
  readonly filterNodeOptions?:
    | ((params: {
        readonly whatsappNumber: string
        readonly node: FlowNodeData
        readonly options: readonly (readonly [string, string])[]
      }) => Promise<readonly (readonly [string, string])[]>)
    | undefined
}

/**
 * O que o grafo decidiu sobre a mensagem.
 *
 * `handled: false` com `replayMessage` é o caso da lista guardada: o grafo atendeu a mensagem atual (o
 * nome), e o que a engine precisa tratar agora é a lista que o cliente havia ditado ANTES de o bot
 * saber quem ele era. Sem este campo, a engine receberia o nome como se fosse a lista.
 */
export type HandleInboundResult =
  | { readonly handled: true }
  | { readonly handled: false; readonly replayMessage?: ParsedInboundMessage }

export type HandleInboundParams = {
  readonly session: ModuleSession
  readonly message: ParsedInboundMessage
}

// A resposta que o grafo consome: para interativo é o ID da opção (estável), não o título, que
// muda toda vez que alguém edita o texto do botão no editor.
function extractAnswer(message: ParsedInboundMessage): string | undefined {
  if (message.kind === 'text') return message.body
  if (message.kind === 'button_reply') return message.buttonId
  if (message.kind === 'list_reply') return message.listId
  return undefined
}

export class FlowDriver {
  constructor(private readonly dependencies: FlowDriverDependencies) {}

  /**
   * A resposta que o grafo consome.
   *
   * Áudio chega aqui já como texto: quem transcreve é o resolvedor da entrada, antes do roteamento.
   * Enquanto a transcrição vivia aqui dentro, voz só era entendida DENTRO do grafo — fora dele o
   * cliente que ditava a compra ouvia "escolha uma opção da lista acima".
   *
   * Áudio que sobrou como áudio é transcrição indisponível: `extractAnswer` devolve `undefined` e o
   * nó repergunta, que é o comportamento correto quando não há o que entender.
   */
  private resolveAnswer(message: ParsedInboundMessage, node: FlowNodeData | undefined): string | undefined {
    const text = extractAnswer(message)
    if (text === undefined) return undefined

    /**
     * Texto livre num nó de escolha vira o id da opção.
     *
     * O interpretador compara a resposta com o id (`next.byAnswer[answerId]`), e nem transcrição nem
     * digitação são iguais a um id — sem traduzir, quem responde o menu falando cai no `default`, que
     * reenvia o menu, e o bot repete a pergunta para sempre.
     *
     * Botão e item de lista não passam por aqui: `extractAnswer` já devolve o id de verdade, e
     * reinterpretá-lo por texto só criaria chance de errar o que já estava certo.
     */
    if (message.kind === 'text') {
      const isChoice = node?.type === 'menu' || node?.questionType === 'choice'
      if (isChoice && node?.options && node.options.length > 0) {
        const optionId = matchChoiceOption(text, node.options)
        // Sem casar: devolve o texto cru e o nó decide (cai no `default`, que normalmente repergunta).
        // Melhor reperguntar que adivinhar entre duas opções e mandar o cliente para o caminho errado.
        flowLog.info('flow_choice_matched', { nodeId: node.id, matched: optionId !== undefined })
        return optionId ?? text
      }
    }

    return text
  }

  registerFlowAction(kind: string, handler: FlowActionHandler): void {
    this.dependencies.interpreter.registerFlowAction(kind, handler)
  }

  // Devolve false quando não havia grafo para atender — o chamador então cai na engine TS, que
  // continua sendo o caminho de quem já está no meio de um carrinho ou checkout.
  async handleInbound(params: HandleInboundParams): Promise<HandleInboundResult> {
    const { session, message } = params

    // Conversa parada num nó retoma dali; conversa nova entra pelo início do fluxo principal.
    const flowKey = session.flowKey ?? MAIN_FLOW_KEY
    const graph = await this.dependencies.loadFlow(flowKey)
    if (!graph) {
      flowLog.warn('flow_not_found', { flowKey })
      return { handled: false }
    }

    const currentNodeId = session.currentNodeId ?? graph.startNodeId
    const node = graph.nodes[currentNodeId]

    /*
     * O nome vem do contexto do FLUXO, não do cadastro: é ele que o nó de saudação preenche, e é o que
     * sobrevive à expiração da sessão da engine — que zera o contexto dela mas não o do grafo.
     */
    const flowContext = (session.context ?? {}) as { readonly customerName?: unknown }
    const hasName = typeof flowContext.customerName === 'string' && flowContext.customerName.length > 0

    if (
      shouldYieldToShoppingList({
        messageKind: message.kind,
        body: message.kind === 'text' ? message.body : '',
        nodeType: node?.type,
        nodeQuestionType: node?.questionType,
        hasOptions: (node?.options?.length ?? 0) > 0,
        matchedOption:
          message.kind === 'text' && node?.options
            ? matchChoiceOption(message.body, node.options) !== undefined
            : false,
        isAtStartNode: currentNodeId === graph.startNodeId,
        hasKnownCustomerName: hasName,
      })
    ) {
      // Solta a posição antes de sair: sem isto a próxima mensagem do cliente reentraria no menu
      // enquanto a engine está no meio da desambiguação, e as duas brigariam pela mesma resposta.
      await this.dependencies.sessionRepository.setFlowPosition(COMPANY_ID, session.whatsappNumber, null, null)
      flowLog.info('flow_yielded_to_shopping_list', { nodeId: currentNodeId })
      return { handled: false }
    }

    /*
     * Lista ditada por quem o bot ainda não conhece: guarda e pede o nome primeiro.
     *
     * Sem isto, o cliente novo mandava "quero 3 quilos de feijão" e recebia só "como você se chama?" —
     * a lista ia para o lixo e ele tinha de repetir. Ceder direto era pior: pularia a coleta de nome e
     * o pedido nasceria "Sem nome" para sempre.
     *
     * Guardada no contexto do grafo, ao lado do `customerName` que está a caminho.
     */
    const isNewCustomerWithList =
      currentNodeId === graph.startNodeId &&
      message.kind === 'text' &&
      !hasName &&
      looksLikeShoppingList(message.body)

    if (isNewCustomerWithList && message.kind === 'text') {
      /*
       * Diz que anotou, antes de o nó pedir o nome.
       *
       * Sem esta frase o cliente manda a lista e recebe só "como você se chama?" — a lista parece
       * ignorada, e é justamente o que ele veio fazer. Vai pelo canal decorado para aparecer na thread
       * do atendente junto do resto.
       */
      await this.wrapChannelWithLogging(session.whatsappNumber).sendText(
        session.whatsappNumber,
        MESSAGES.LIST_SAVED_ASK_NAME_FIRST,
      )
      flowLog.info('flow_list_saved_until_name', {})
    }

    const answer = this.resolveAnswer(message, node)

    const result = await this.dependencies.interpreter.run({
      graph,
      currentNodeId,
      ...(answer !== undefined ? { userAnswer: answer } : {}),
      /*
       * A lista pendente viaja DENTRO do contexto do run, não numa escrita à parte.
       *
       * Gravar por fora antes do run não funciona: o interpretador persiste o contexto que RECEBEU, e
       * a escrita paralela era sobrescrita no mesmo request — a lista sumia em silêncio e o cliente
       * respondia o nome para nada.
       */
      context: isNewCustomerWithList && message.kind === 'text'
        ? { ...(session.context ?? {}), pendingShoppingList: message.body }
        : (session.context ?? {}),
      session,
      // Canal decorado: o interpretador manda pelo adaptador cru, que fala com a Graph API e
      // não grava nada. Sem isto tudo que o grafo diz sumiria da thread — o atendente veria a
      // resposta do cliente sem a pergunta que a provocou.
      channel: this.wrapChannelWithLogging(session.whatsappNumber),
    })

    await this.persistPosition({ session, flowKey, graph, result })

    /*
     * O nome chegou e havia lista guardada: agora ela vale, e a engine é quem monta o carrinho.
     *
     * Lê o contexto DEPOIS do interpretador porque é ele que grava o `customerName` — antes dele o
     * nome ainda não existe. Limpa a pendência na mesma escrita: lista retomada duas vezes viraria
     * carrinho em dobro.
     */
    const sessionAfterRun = await this.dependencies.sessionRepository.getContext(COMPANY_ID, session.whatsappNumber)
    const contextAfterRun = (sessionAfterRun?.context ?? {}) as {
      readonly pendingShoppingList?: unknown
      readonly customerName?: unknown
    }
    const pendingList = contextAfterRun.pendingShoppingList
    const nameNowKnown =
      typeof contextAfterRun.customerName === 'string' && contextAfterRun.customerName.length > 0

    if (typeof pendingList === 'string' && pendingList.length > 0 && nameNowKnown) {
      const contextWithoutPending = { ...contextAfterRun }
      delete (contextWithoutPending as { pendingShoppingList?: unknown }).pendingShoppingList
      await this.dependencies.sessionRepository.setState(
        COMPANY_ID,
        session.whatsappNumber,
        sessionAfterRun?.currentState ?? session.currentState,
        contextWithoutPending,
      )
      // Solta a posição: a engine assume a conversa a partir daqui, e o grafo reentraria no menu.
      await this.dependencies.sessionRepository.setFlowPosition(COMPANY_ID, session.whatsappNumber, null, null)
      flowLog.info('flow_replayed_saved_list', {})

      return {
        handled: false,
        replayMessage: { kind: 'text', from: session.whatsappNumber, waMessageId: message.waMessageId, body: pendingList },
      }
    }

    if (result.kind === 'max-steps-exceeded') {
      // Ciclo no grafo desenhado pelo lojista. Não dá para deixar a conversa presa: solta a
      // posição para a próxima mensagem recomeçar do início em vez de repetir o laço.
      flowLog.error('flow_cycle_detected', { flowKey, visited: result.visited.join(' → ') })
      await this.dependencies.sessionRepository.setFlowPosition(COMPANY_ID, session.whatsappNumber, null, null)
    }

    return { handled: true }
  }

  // O interpretador para em `awaiting-answer` e NÃO envia a pergunta — ele devolve em que nó
  // parou e espera que o host fale com o cliente. Sem isto a conversa fica parada num nó em
  // silêncio: o cliente nunca vê a pergunta que deveria responder.
  private async askNode(whatsappNumber: string, node: FlowNodeData | undefined): Promise<void> {
    if (!node?.question) return

    const channel = this.wrapChannelWithLogging(whatsappNumber)
    const declaredOptions = node.options ?? []
    const { filterNodeOptions } = this.dependencies
    const options =
      filterNodeOptions && declaredOptions.length > 0
        ? await filterNodeOptions({ whatsappNumber, node, options: declaredOptions })
        : declaredOptions

    if (options.length === 0) {
      await channel.sendText(whatsappNumber, node.question)
      return
    }

    await channel.sendInteractiveList({
      to: whatsappNumber,
      body: node.question,
      buttonLabel: 'Escolher',
      rows: options.map(([id, title]) => ({ id, title })),
    })
  }

  private wrapChannelWithLogging(whatsappNumber: string): ChannelAdapterInterface {
    const { channel, logMessage, startState } = this.dependencies
    return wrapChannelWithLogging({ channel, logMessage, companyId: COMPANY_ID, whatsappNumber, startState })
  }

  private async persistPosition(params: {
    session: ModuleSession
    flowKey: string
    graph: FlowGraphData
    result: Awaited<ReturnType<FlowInterpreter['run']>>
  }): Promise<void> {
    const { session, flowKey, result } = params
    const { whatsappNumber } = session

    // O contexto acumulado pelo grafo (respostas capturadas por contextKey) precisa sobreviver
    // à mensagem — é ele que carrega o que o cliente já respondeu para os nós seguintes.
    //
    // O estado é RELIDO do banco, não reaproveitado de `session`: uma ação que rodou durante o
    // run pode tê-lo mudado (é assim que o grafo entrega a conversa à engine), e gravar o valor
    // lido antes do run desfaria essa entrega em silêncio.
    const current = await this.dependencies.sessionRepository.getContext(COMPANY_ID, whatsappNumber)
    await this.dependencies.sessionRepository.setState(
      COMPANY_ID,
      whatsappNumber,
      current?.currentState ?? session.currentState,
      result.context,
    )

    if (result.kind === 'awaiting-answer') {
      await this.dependencies.sessionRepository.setFlowPosition(COMPANY_ID, whatsappNumber, flowKey, result.nodeId)
      await this.askNode(whatsappNumber, params.graph.nodes[result.nodeId])
      return
    }

    if (result.kind === 'cross-flow') {
      const target = await this.dependencies.loadFlow(result.flowKey)
      if (!target) {
        flowLog.error('cross_flow_target_missing', { from: flowKey, to: result.flowKey })
        await this.dependencies.sessionRepository.setFlowPosition(COMPANY_ID, whatsappNumber, null, null)
        return
      }
      await this.dependencies.sessionRepository.setFlowPosition(
        COMPANY_ID,
        whatsappNumber,
        result.flowKey,
        target.startNodeId,
      )
      return
    }

    // 'terminal': o grafo chegou ao fim, normalmente porque uma ação entregou a conversa à
    // engine TS. Soltar a posição é o que impede a próxima mensagem de reentrar no grafo em
    // vez de continuar o carrinho que a ação abriu.
    await this.dependencies.sessionRepository.setFlowPosition(COMPANY_ID, whatsappNumber, null, null)
  }
}
