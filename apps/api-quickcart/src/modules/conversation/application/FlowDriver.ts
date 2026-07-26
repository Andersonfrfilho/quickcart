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
import type { FlowInterpreter, LogMessageUseCase, SessionRepository } from '@adatechnology/meta-whatsapp-module'
import { logger } from '@/shared/logger'
import { environment } from '@/infra/config/environment'
import type { ChannelAdapterInterface, ConversationSession as ModuleSession } from '@adatechnology/meta-whatsapp-contracts'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const flowLog = logger.child('FlowDriver')
const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

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
}

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

  registerFlowAction(kind: string, handler: FlowActionHandler): void {
    this.dependencies.interpreter.registerFlowAction(kind, handler)
  }

  // Devolve false quando não havia grafo para atender — o chamador então cai na engine TS, que
  // continua sendo o caminho de quem já está no meio de um carrinho ou checkout.
  async handleInbound(params: HandleInboundParams): Promise<boolean> {
    const { session, message } = params

    // Conversa parada num nó retoma dali; conversa nova entra pelo início do fluxo principal.
    const flowKey = session.flowKey ?? MAIN_FLOW_KEY
    const graph = await this.dependencies.loadFlow(flowKey)
    if (!graph) {
      flowLog.warn('flow_not_found', { flowKey })
      return false
    }

    const currentNodeId = session.currentNodeId ?? graph.startNodeId
    const answer = extractAnswer(message)

    const result = await this.dependencies.interpreter.run({
      graph,
      currentNodeId,
      ...(answer !== undefined ? { userAnswer: answer } : {}),
      context: session.context ?? {},
      session,
      // Canal decorado: o interpretador manda pelo adaptador cru, que fala com a Graph API e
      // não grava nada. Sem isto tudo que o grafo diz sumiria da thread — o atendente veria a
      // resposta do cliente sem a pergunta que a provocou.
      channel: this.wrapChannelWithLogging(session.whatsappNumber),
    })

    await this.persistPosition({ session, flowKey, graph, result })

    if (result.kind === 'max-steps-exceeded') {
      // Ciclo no grafo desenhado pelo lojista. Não dá para deixar a conversa presa: solta a
      // posição para a próxima mensagem recomeçar do início em vez de repetir o laço.
      flowLog.error('flow_cycle_detected', { flowKey, visited: result.visited.join(' → ') })
      await this.dependencies.sessionRepository.setFlowPosition(COMPANY_ID, session.whatsappNumber, null, null)
    }

    return true
  }

  // O interpretador para em `awaiting-answer` e NÃO envia a pergunta — ele devolve em que nó
  // parou e espera que o host fale com o cliente. Sem isto a conversa fica parada num nó em
  // silêncio: o cliente nunca vê a pergunta que deveria responder.
  private async askNode(whatsappNumber: string, node: FlowNodeData | undefined): Promise<void> {
    if (!node?.question) return

    const channel = this.wrapChannelWithLogging(whatsappNumber)
    const options = node.options ?? []

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

    const log = async (type: string, content: string | null, sent: { externalMessageId: string | null }) => {
      await logMessage.execute({
        companyId: COMPANY_ID,
        whatsappNumber,
        direction: 'outbound',
        sender: 'bot',
        type,
        content,
        waMessageId: sent.externalMessageId,
        status: 'sent',
        startState,
      })
    }

    return {
      sendText: async (to, body) => {
        const sent = await channel.sendText(to, body)
        await log('text', body, sent)
        return sent
      },
      sendMedia: async (mediaParams) => {
        const sent = await channel.sendMedia(mediaParams)
        await log('media', mediaParams.caption ?? mediaParams.filename, sent)
        return sent
      },
      sendTemplate: async (templateParams) => {
        const sent = await channel.sendTemplate(templateParams)
        await log('template', templateParams.templateName, sent)
        return sent
      },
      sendInteractiveList: async (listParams) => {
        const sent = await channel.sendInteractiveList(listParams)
        await log('interactive_list', listParams.body, sent)
        return sent
      },
      fetchMediaAsBase64: (mediaId) => channel.fetchMediaAsBase64(mediaId),
    }
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
