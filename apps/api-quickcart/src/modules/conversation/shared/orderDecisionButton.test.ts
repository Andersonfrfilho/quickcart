/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Os limites do WhatsApp são conferidos AQUI, e não no envio.
 *
 * Título acima de 20 caracteres não sai truncado: a Graph API recusa a mensagem inteira, e o cliente que
 * está esperando resposta sobre a compra vê silêncio. Como o envio acontece longe de quem escreve o texto,
 * esse erro só apareceria em produção — "🛒 Montar outra lista" tem 21 com o emoji e chegou a ser escrito.
 */

import { describe, expect, it } from 'bun:test'
import { WHATSAPP_BUTTON_TITLE_MAX_LENGTH, WHATSAPP_MAX_BUTTONS } from '@/modules/shared/shared.constant'
import {
  CART_REVIEW_BUTTONS,
  CONFIRMING_BUTTONS,
  DELIVERY_TYPE_BUTTONS,
  MENU_BUTTONS,
  PAYMENT_METHOD_BUTTONS,
  RECEIPT_PREFERENCE_BUTTONS,
  REMEMBERED_CHECKOUT_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'
import { buildOrderDecisionButtons, ORDER_DECISION, parseOrderDecisionButtonId } from './orderDecisionButton'

const ORDER_ID = '5d9f1b2c-0f4a-4a1e-9b3e-2c6a7d8e9f01'

const DECLARED_BUTTON_SETS = {
  MENU_BUTTONS,
  CART_REVIEW_BUTTONS,
  DELIVERY_TYPE_BUTTONS,
  PAYMENT_METHOD_BUTTONS,
  RECEIPT_PREFERENCE_BUTTONS,
  REMEMBERED_CHECKOUT_BUTTONS,
  CONFIRMING_BUTTONS,
  ORDER_DECISION_WITH_ITEMS_LEFT: buildOrderDecisionButtons({ orderId: ORDER_ID, hasAnythingLeft: true }),
  ORDER_DECISION_NOTHING_LEFT: buildOrderDecisionButtons({ orderId: ORDER_ID, hasAnythingLeft: false }),
} as const

describe('limites de resposta rápida do WhatsApp', () => {
  for (const [name, buttons] of Object.entries(DECLARED_BUTTON_SETS)) {
    it(`${name} cabe no teto de título e de quantidade`, () => {
      expect(buttons.length).toBeLessThanOrEqual(WHATSAPP_MAX_BUTTONS)

      for (const button of buttons) {
        // `[...title]` e não `.length`: emoji fora do BMP conta 2 em UTF-16 e falsearia a medida.
        expect([...button.title].length).toBeLessThanOrEqual(WHATSAPP_BUTTON_TITLE_MAX_LENGTH)
      }
    })
  }

  it('todo botão de decisão leva emoji, que é o que o olho acha antes da palavra', () => {
    const buttons = [
      ...DECLARED_BUTTON_SETS.ORDER_DECISION_WITH_ITEMS_LEFT,
      ...DECLARED_BUTTON_SETS.ORDER_DECISION_NOTHING_LEFT,
    ]

    for (const button of buttons) {
      expect(button.title).toMatch(/^\p{Extended_Pictographic}/u)
    }
  })
})

describe('roteamento da resposta', () => {
  it('não oferece "seguir assim" quando não sobrou nada para seguir', () => {
    const buttons = buildOrderDecisionButtons({ orderId: ORDER_ID, hasAnythingLeft: false })
    const decisions = buttons.map((button) => parseOrderDecisionButtonId(button.id)?.decision)

    expect(decisions).toEqual([ORDER_DECISION.NEW_LIST, ORDER_DECISION.CANCEL])
  })

  it('devolve o pedido que produziu a pergunta, e não o "atual" da sessão', () => {
    const [continueButton] = buildOrderDecisionButtons({ orderId: ORDER_ID, hasAnythingLeft: true })

    expect(parseOrderDecisionButtonId(continueButton!.id)).toEqual({
      decision: ORDER_DECISION.CONTINUE,
      orderId: ORDER_ID,
    })
  })

  it('ignora botão de outro fluxo, para o handler seguir adiante', () => {
    expect(parseOrderDecisionButtonId('repeat_order')).toBeUndefined()
  })
})
