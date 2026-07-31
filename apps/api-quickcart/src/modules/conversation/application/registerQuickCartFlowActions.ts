/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * As ações que o grafo pode invocar. Cada uma entrega a conversa a um estado da engine TS: o
 * grafo decide QUANDO entrar em "montar lista", "navegar catálogo" ou "repetir pedido", e o
 * código existente cuida do COMO — matching por LLM, aritmética de carrinho, estoque.
 *
 * Depois que uma ação entrega o controle, o grafo termina (o FlowDriver solta a posição) e as
 * próximas mensagens vão para a engine, até ela devolver a conversa ao menu.
 */

import type { FlowActionHandler } from '@adatechnology/meta-whatsapp-contracts'
import type { SessionRepository } from '@adatechnology/meta-whatsapp-module'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { judgeCustomerName } from '@/modules/conversation/application/customerNameGuard'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { RepeatLastOrderUseCase } from '@/modules/order/application/use-cases/RepeatLastOrder.use-case'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { OrderNoPreviousOrderError } from '@/shared/errors/OrderErrors'
import { CHANNEL } from '@/modules/shared/shared.constant'

const actionLog = logger.child('FlowAction')
const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

// Nomes que o lojista escolhe no editor ao criar um nó de ação. São contrato com a UI: mudar
// um destes quebra os grafos já desenhados, então entram como constante e não como literal.
export const QUICKCART_FLOW_ACTION = {
  START_LIST: 'quickcart_start_list',
  BROWSE_CATALOG: 'quickcart_browse_catalog',
  REPEAT_ORDER: 'quickcart_repeat_order',
  GREET: 'quickcart_greet',
  VALIDATE_NAME: 'quickcart_validate_name',
} as const

/**
 * Nós que as ações de saudação desviam para. Ficam como constante porque o handler devolve
 * `next` por id — um literal solto aqui e um nó renomeado no editor viram uma conversa que morre
 * num destino inexistente, sem erro nenhum.
 */
export const MAIN_FLOW_NODE = {
  ASK_NAME: 'pergunta_nome',
  /**
   * Repergunta do nome, com texto próprio.
   *
   * Nó separado, e não a mesma pergunta de novo: voltar para `ASK_NAME` fazia o cliente receber
   * DUAS mensagens — a recusa da ação e, atrás dela, a boas-vindas inteira ("Olá! Eu sou o
   * assistente...") como se fosse o primeiro contato. Quem já está na segunda tentativa não precisa
   * ser apresentado ao bot outra vez.
   */
  ASK_NAME_RETRY: 'pergunta_nome_retry',
  /** Mesma ideia da repergunta, para resposta curta demais — o motivo muda, o texto muda. */
  ASK_NAME_TOO_SHORT: 'pergunta_nome_curto',
  MENU: 'menu',
} as const

export type RegisterQuickCartFlowActionsParams = {
  readonly registerFlowAction: (kind: string, handler: FlowActionHandler) => void
  readonly sessionRepository: SessionRepository
  readonly whatsAppSender: WhatsAppSender
  readonly customerRepository: CustomerRepositoryInterface
  readonly repeatLastOrderUseCase: RepeatLastOrderUseCase
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
}

export function registerQuickCartFlowActions(params: RegisterQuickCartFlowActionsParams): void {
  const {
    registerFlowAction,
    sessionRepository,
    whatsAppSender,
    customerRepository,
    repeatLastOrderUseCase,
    cartRepository,
    productRepository,
  } = params

  // Entrega a conversa a um estado da engine TS. O contexto do grafo é preservado: o cliente
  // pode ter respondido coisas antes de chegar aqui, e a engine lê o mesmo `context`.
  async function handOver(whatsappNumber: string, state: string, context: Record<string, unknown>): Promise<void> {
    await sessionRepository.setState(COMPANY_ID, whatsappNumber, state, context)
    actionLog.info('handed_over_to_engine', { state })
  }

  /**
   * Porta de entrada: decide entre pedir o nome e receber de volta quem já se apresentou.
   *
   * É ação, e não nó de condição, por duas razões. `evaluateCondition` ignora `conditionValue`
   * vazio e transforma chave ausente na string `"undefined"`, então "tem nome?" não se expressa com
   * os operadores disponíveis. E a saudação de retorno precisa interpolar o nome na mensagem —
   * coisa que nó de condição não faz.
   *
   * A fonte da verdade é `customers.name`, não o contexto da sessão: contexto se perde ao reiniciar
   * a conversa, e um cliente que já disse o nome não deve dizer de novo por causa disso.
   */
  registerFlowAction(QUICKCART_FLOW_ACTION.GREET, async ({ session }) => {
    const customer = await customerRepository.findByPhone(session.whatsappNumber)
    const savedName = customer?.name?.trim()

    if (!savedName) return { next: MAIN_FLOW_NODE.ASK_NAME }

    await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.WELCOME_BACK.replace('{nome}', savedName))
    // Devolve ao contexto para o painel do atendente e os nós seguintes lerem sem consultar o banco.
    return { next: MAIN_FLOW_NODE.MENU, context: { customerName: savedName } }
  })

  /**
   * Aceita ou recusa o nome que o cliente respondeu.
   *
   * Recusar volta para a MESMA pergunta em vez de seguir: aceitar xingamento gravaria em
   * `customers.name` o texto que depois aparece no painel, na etiqueta de entrega e na nota fiscal.
   * O laço é seguro porque o nó de pergunta espera resposta nova — não há como girar sozinho.
   */
  registerFlowAction(QUICKCART_FLOW_ACTION.VALIDATE_NAME, async ({ session, context }) => {
    const answer = typeof context['customerName'] === 'string' ? context['customerName'] : undefined
    const verdict = judgeCustomerName(answer)

    if (verdict.kind === 'rejected') {
      actionLog.info('customer_name_rejected', { reason: verdict.reason })
      /**
       * Só desvia — o texto da recusa é a pergunta do nó de destino.
       *
       * Mandar a recusa aqui E cair num nó que pergunta produzia duas mensagens em sequência, a
       * segunda repetindo a boas-vindas. Uma pergunta por vez.
       */
      return {
        next: verdict.reason === 'offensive' ? MAIN_FLOW_NODE.ASK_NAME_RETRY : MAIN_FLOW_NODE.ASK_NAME_TOO_SHORT,
        // Limpa em vez de deixar o texto recusado: o painel mostraria o xingamento como "Nome".
        context: { customerName: '' },
      }
    }

    await customerRepository.upsertByPhone({ phone: session.whatsappNumber, name: verdict.name })
    await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.NAME_ACCEPTED.replace('{nome}', verdict.name))

    return { next: MAIN_FLOW_NODE.MENU, context: { customerName: verdict.name } }
  })

  registerFlowAction(QUICKCART_FLOW_ACTION.START_LIST, async ({ session, context }) => {
    await handOver(session.whatsappNumber, CONVERSATION_STATE.AWAITING_LIST, context)
    await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.AWAITING_LIST_PROMPT)
  })

  registerFlowAction(QUICKCART_FLOW_ACTION.BROWSE_CATALOG, async ({ session, context }) => {
    // Só posiciona o estado e devolve: quem monta a lista de categorias é o BrowseHandler, na
    // próxima mensagem. Duplicar essa montagem aqui criaria duas fontes para a mesma tela.
    await handOver(session.whatsappNumber, CONVERSATION_STATE.BROWSING_CATEGORIES, context)
    await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.BROWSE_CATALOG_PROMPT)
  })

  // Espelha o caminho do GlobalHandler para "repetir pedido": mesmas mensagens, mesmo resumo
  // de carrinho, mesmo estado final. Divergir aqui daria ao cliente duas experiências
  // diferentes para a mesma intenção, dependendo de ele ter tocado no botão ou digitado.
  registerFlowAction(QUICKCART_FLOW_ACTION.REPEAT_ORDER, async ({ session, context }) => {
    const customer = await customerRepository.findByPhone(session.whatsappNumber)
    if (!customer) {
      await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.REPEAT_ORDER_UNAVAILABLE)
      return
    }

    try {
      const result = await repeatLastOrderUseCase.execute({ customerId: customer.id, channel: CHANNEL.WHATSAPP })

      if (result.skippedItems.length > 0) {
        const skippedNames = result.skippedItems.map((item) => `• ${item.productName}`).join('\n')
        await whatsAppSender.sendText(session.whatsappNumber, `${MESSAGES.REPEAT_ORDER_SKIPPED_PREFIX}\n${skippedNames}`)
      }

      await handOver(session.whatsappNumber, CONVERSATION_STATE.CART_REVIEW, context)
      await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.REPEAT_ORDER_ADDED)
      await sendCartSummary({
        customerPhone: session.whatsappNumber,
        cartId: result.cart.id,
        cartRepository,
        productRepository,
        whatsAppSender,
      })
    } catch (error) {
      if (error instanceof OrderNoPreviousOrderError) {
        await whatsAppSender.sendText(session.whatsappNumber, MESSAGES.REPEAT_ORDER_UNAVAILABLE)
        return
      }
      throw error
    }
  })
}
