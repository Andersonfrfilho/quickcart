/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Os botões da pergunta "faltou item, e agora?" — montagem e leitura no mesmo arquivo.
 *
 * Juntos de propósito: o id que sai no botão e o id que volta no `button_reply` são o mesmo contrato, e
 * separá-los em dois arquivos é como esses contratos divergem em silêncio — o envio muda o prefixo, a
 * leitura continua casando o antigo, e o toque do cliente não faz nada sem ninguém ver.
 */

import { ORDER_DECISION_BUTTON_PREFIX } from '@/modules/conversation/shared/Messages.constant'

export const ORDER_DECISION = {
  CONTINUE: 'continue',
  CANCEL: 'cancel',
  NEW_LIST: 'new_list',
  /** Aceita o parecido oferecido para UM item. */
  SUBSTITUTE: 'substitute',
  /** Recusa o parecido e segue sem AQUELE item — o resto do pedido continua de pé. */
  SKIP_ITEM: 'skip_item',
} as const

export type OrderDecision = (typeof ORDER_DECISION)[keyof typeof ORDER_DECISION]

export type OrderDecisionButton = {
  readonly id: string
  readonly title: string
}

/**
 * Títulos dentro do teto de 20 caracteres do WhatsApp, emoji incluído (ver `shared.constant.ts`).
 *
 * "🛒 Nova lista" e não "🛒 Montar outra lista": a segunda tem 21 com o emoji, e a Meta recusaria a
 * mensagem inteira em vez de cortar a palavra.
 */
const DECISION_BUTTON_TITLE = {
  CONTINUE: '✅ Seguir assim',
  CANCEL: '❌ Cancelar pedido',
  NEW_LIST: '🛒 Nova lista',
  SUBSTITUTE: '🔄 Trocar',
  SKIP_ITEM: '➡️ Sem ele',
} as const

/**
 * Dois botões, nunca três: com nada sobrando, "seguir assim" seguiria com o quê?
 *
 * `hasAnythingLeft` troca o par inteiro em vez de acrescentar uma opção — oferecer "seguir" num pedido
 * vazio produziria um pedido de total zero saindo para entrega.
 */
export function buildOrderDecisionButtons(params: {
  readonly orderId: string
  readonly hasAnythingLeft: boolean
}): readonly OrderDecisionButton[] {
  const cancel = {
    id: `${ORDER_DECISION_BUTTON_PREFIX.CANCEL}${params.orderId}`,
    title: DECISION_BUTTON_TITLE.CANCEL,
  }

  if (!params.hasAnythingLeft) {
    return [
      { id: `${ORDER_DECISION_BUTTON_PREFIX.NEW_LIST}${params.orderId}`, title: DECISION_BUTTON_TITLE.NEW_LIST },
      cancel,
    ]
  }

  return [
    { id: `${ORDER_DECISION_BUTTON_PREFIX.CONTINUE}${params.orderId}`, title: DECISION_BUTTON_TITLE.CONTINUE },
    cancel,
  ]
}

/**
 * Os três botões da oferta de troca de UM item (ADR 0003).
 *
 * Três, e não os dois de cima: aqui a pergunta é sobre um item, e as respostas possíveis são três de
 * verdade — trocar, seguir sem ele, ou desistir do pedido inteiro. Cabe: o teto do WhatsApp é três.
 */
export function buildItemSubstitutionButtons(params: {
  readonly orderId: string
  readonly orderItemId: string
  readonly substituteProductId: string
}): readonly OrderDecisionButton[] {
  return [
    {
      id: `${ORDER_DECISION_BUTTON_PREFIX.SUBSTITUTE}${params.orderId}:${params.orderItemId}:${params.substituteProductId}`,
      title: DECISION_BUTTON_TITLE.SUBSTITUTE,
    },
    {
      id: `${ORDER_DECISION_BUTTON_PREFIX.SKIP_ITEM}${params.orderId}:${params.orderItemId}`,
      title: DECISION_BUTTON_TITLE.SKIP_ITEM,
    },
    { id: `${ORDER_DECISION_BUTTON_PREFIX.CANCEL}${params.orderId}`, title: DECISION_BUTTON_TITLE.CANCEL },
  ]
}

/**
 * O que voltou do toque. União, e não um tipo com campos opcionais: a troca SEM o item ou sem o produto
 * não existe, e campo opcional obrigaria cada leitor a checar de novo o que o parse já sabe.
 */
export type ParsedOrderDecision =
  | {
      readonly decision: Extract<OrderDecision, 'continue' | 'cancel' | 'new_list'>
      readonly orderId: string
    }
  | {
      readonly decision: Extract<OrderDecision, 'substitute'>
      readonly orderId: string
      readonly orderItemId: string
      readonly substituteProductId: string
    }
  | {
      readonly decision: Extract<OrderDecision, 'skip_item'>
      readonly orderId: string
      readonly orderItemId: string
    }

/** Lê o id que voltou. `undefined` = não é botão de decisão, e quem chamou segue para o próximo handler. */
export function parseOrderDecisionButtonId(buttonId: string): ParsedOrderDecision | undefined {
  /*
   * Os compostos vêm primeiro porque id malformado tem que morrer aqui, e não virar decisão pela metade:
   * `order_swap:` sem os três segmentos é `undefined`, e a mensagem segue para o próximo handler.
   */
  if (buttonId.startsWith(ORDER_DECISION_BUTTON_PREFIX.SUBSTITUTE)) {
    const [orderId, orderItemId, substituteProductId] = buttonId
      .slice(ORDER_DECISION_BUTTON_PREFIX.SUBSTITUTE.length)
      .split(':')

    if (!orderId || !orderItemId || !substituteProductId) return undefined
    return { decision: ORDER_DECISION.SUBSTITUTE, orderId, orderItemId, substituteProductId }
  }

  if (buttonId.startsWith(ORDER_DECISION_BUTTON_PREFIX.SKIP_ITEM)) {
    const [orderId, orderItemId] = buttonId.slice(ORDER_DECISION_BUTTON_PREFIX.SKIP_ITEM.length).split(':')

    if (!orderId || !orderItemId) return undefined
    return { decision: ORDER_DECISION.SKIP_ITEM, orderId, orderItemId }
  }

  if (buttonId.startsWith(ORDER_DECISION_BUTTON_PREFIX.CONTINUE)) {
    return {
      decision: ORDER_DECISION.CONTINUE,
      orderId: buttonId.slice(ORDER_DECISION_BUTTON_PREFIX.CONTINUE.length),
    }
  }

  if (buttonId.startsWith(ORDER_DECISION_BUTTON_PREFIX.NEW_LIST)) {
    return {
      decision: ORDER_DECISION.NEW_LIST,
      orderId: buttonId.slice(ORDER_DECISION_BUTTON_PREFIX.NEW_LIST.length),
    }
  }

  if (buttonId.startsWith(ORDER_DECISION_BUTTON_PREFIX.CANCEL)) {
    return {
      decision: ORDER_DECISION.CANCEL,
      orderId: buttonId.slice(ORDER_DECISION_BUTTON_PREFIX.CANCEL.length),
    }
  }

  return undefined
}
