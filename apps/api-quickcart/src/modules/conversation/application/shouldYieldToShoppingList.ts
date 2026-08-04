/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Quando o grafo entrega a conversa à engine porque o cliente ditou a lista.
 *
 * O grafo tem a primeira palavra em toda mensagem, então sem esta decisão o `GlobalHandler` — que
 * sabe montar carrinho a partir de "dois quilos de arroz e um litro de leite" — nunca é alcançado.
 *
 * Função pura, e fora do FlowDriver, porque é ela que decide se a fala do cliente vira carrinho ou
 * vira nada: o caso que motivou extrair é a volta de um cliente depois de um dia, que manda uma nota
 * de voz com a lista e recebia uma saudação com menu — a lista transcrita e descartada em silêncio.
 */

import { looksLikeShoppingList } from '@/modules/conversation/application/looksLikeShoppingList'

export type ShouldYieldToShoppingListParams = {
  /** Já com áudio resolvido em texto: a decisão é sobre o que o cliente DISSE, não sobre o formato. */
  readonly messageKind: string
  readonly body: string
  /** Tipo do nó atual (`menu`, `question`, `action`…) e o `questionType`, quando houver. */
  readonly nodeType: string | undefined
  readonly nodeQuestionType: string | undefined
  readonly hasOptions: boolean
  /** `true` quando alguma opção do nó casou com a mensagem — aí a resposta pertence ao nó. */
  readonly matchedOption: boolean
  /**
   * Conversa parada no começo do fluxo: sessão nova, ou expirada e reiniciada.
   *
   * É o caso mais comum na vida real — o cliente volta no dia seguinte e manda a lista de uma vez —
   * e era exatamente o que se perdia, porque o nó inicial é `action` sem opções e a regra antiga só
   * cedia em nó de escolha.
   */
  readonly isAtStartNode: boolean
  /**
   * O fluxo já sabe o nome de quem está falando.
   *
   * Sem nome, quem manda é a coleta de nome: ceder ali pularia a pergunta e o pedido nasceria de
   * "Sem nome" para sempre. Com nome, não há dado pendente e a lista é o assunto.
   */
  readonly hasKnownCustomerName: boolean
}

export function shouldYieldToShoppingList(params: ShouldYieldToShoppingListParams): boolean {
  if (params.messageKind !== 'text') return false
  if (!looksLikeShoppingList(params.body)) return false

  /*
   * Nó de escolha em que nenhuma opção casou: o menu diz "pode me mandar sua lista", e quem obedecia
   * recebia o menu de novo, porque nenhuma opção casa com uma lista e o nó caía no `default`.
   */
  const isChoiceNode = params.nodeType === 'menu' || params.nodeQuestionType === 'choice'
  if (isChoiceNode && params.hasOptions && !params.matchedOption) return true

  // Começo do fluxo, cliente conhecido: nada pendente para o nó guardar, e a lista é o assunto.
  if (params.isAtStartNode && params.hasKnownCustomerName) return true

  /*
   * Todo o resto fica com o grafo — inclusive nó que pede um dado específico ("qual seu nome?", "qual
   * o número?"). Sair de um nó desses perderia o que a pessoa acabou de responder, e uma resposta
   * como "500, apto 12" pode até parecer lista pela forma.
   */
  return false
}
