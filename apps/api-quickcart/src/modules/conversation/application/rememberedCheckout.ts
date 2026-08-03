/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Reaproveita as escolhas de fechamento do último pedido, para não perguntar o que já se sabe.
 *
 * Um cliente semanal que toca em "repetir última compra" gastava seis toques para levar o mesmo de
 * sempre, e quatro deles eram respostas idênticas às da semana passada — entrega, endereço, pagamento,
 * recibo. O dado já estava gravado no pedido anterior; faltava usá-lo.
 *
 * É memória, não automação: nada é aplicado sem o cliente ver o que vai valer e concordar. A mesma
 * lógica do "tanto faz" da desambiguação — o produto mostra a escolha, o cliente confirma num toque.
 *
 * Validar contra as opções ATUAIS é o ponto delicado: forma de pagamento sai do produto, tipo de
 * entrega muda. Replayar um valor que não existe mais criaria um pedido que a loja não sabe atender,
 * e o cliente descobriria na hora de pagar.
 */

import type { OrderRecord } from '@/modules/order/domain/OrderRepository.interface'
import { formatAddressLine } from '@/modules/shared/address/formatAddressLine'
import {
  DELIVERY_TYPE_BUTTON_ID,
  DELIVERY_TYPE_BUTTONS,
  PAYMENT_METHOD_BUTTON_ID,
  PAYMENT_METHOD_BUTTONS,
  RECEIPT_PREFERENCE_BUTTON_ID,
  RECEIPT_PREFERENCE_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'

const SUPPORTED_DELIVERY_TYPES: ReadonlySet<string> = new Set(Object.values(DELIVERY_TYPE_BUTTON_ID))
const SUPPORTED_PAYMENT_METHODS: ReadonlySet<string> = new Set(Object.values(PAYMENT_METHOD_BUTTON_ID))
const SUPPORTED_RECEIPT_PREFERENCES: ReadonlySet<string> = new Set(Object.values(RECEIPT_PREFERENCE_BUTTON_ID))

/** Preferências que exigem e-mail — sem ele guardado, o atalho não se completa. */
const RECEIPT_PREFERENCES_NEEDING_EMAIL: ReadonlySet<string> = new Set([
  RECEIPT_PREFERENCE_BUTTON_ID.EMAIL,
  RECEIPT_PREFERENCE_BUTTON_ID.BOTH,
])

export type RememberedCheckout = {
  readonly deliveryType: string
  readonly address?: unknown
  readonly paymentMethod: string
  readonly receiptPreference: string
  readonly email?: string
}

export type ToRememberedCheckoutParams = {
  readonly lastOrder: OrderRecord | undefined
  /** Do cadastro do cliente, não do pedido: o pedido guarda a preferência, não o endereço de e-mail. */
  readonly customerEmail?: string | null | undefined
}

/**
 * `undefined` quando não há o que reaproveitar com segurança — e aí o checkout pergunta como sempre.
 *
 * Devolver algo incompleto seria pior que não devolver: o cliente confirmaria "igual à última vez" e
 * ainda receberia perguntas, o que faz o atalho parecer quebrado.
 */
export function toRememberedCheckout({
  lastOrder,
  customerEmail,
}: ToRememberedCheckoutParams): RememberedCheckout | undefined {
  if (!lastOrder) return undefined

  const { deliveryType, paymentMethod, receiptPreference } = lastOrder
  if (!SUPPORTED_DELIVERY_TYPES.has(deliveryType)) return undefined
  if (!SUPPORTED_PAYMENT_METHODS.has(paymentMethod)) return undefined
  if (!SUPPORTED_RECEIPT_PREFERENCES.has(receiptPreference)) return undefined

  // Entrega sem endereço guardado não dá atalho: perguntar o endereço é o caminho normal, e inventar
  // um a partir de pedido antigo entregaria compra no lugar errado.
  if (deliveryType === DELIVERY_TYPE_BUTTON_ID.DELIVERY && !lastOrder.address) return undefined

  const email = customerEmail?.trim()
  if (RECEIPT_PREFERENCES_NEEDING_EMAIL.has(receiptPreference) && !email) return undefined

  return {
    deliveryType,
    ...(lastOrder.address ? { address: lastOrder.address } : {}),
    paymentMethod,
    receiptPreference,
    ...(email ? { email } : {}),
  }
}

/** Rótulo que o cliente já viu nos botões — mesma palavra na pergunta e na confirmação. */
function labelOf(buttons: readonly { readonly id: string; readonly title: string }[], id: string): string {
  return buttons.find((button) => button.id === id)?.title ?? id
}

/**
 * Resumo do que vai valer, em linguagem de cliente.
 *
 * Reusa os títulos dos botões de propósito: se a confirmação dissesse "pickup" e o botão dizia
 * "🏪 Retirada", o cliente teria de traduzir para conferir — e conferir é a única função desta tela.
 */
export function describeRememberedCheckout(remembered: RememberedCheckout): string {
  const lines = [
    labelOf(DELIVERY_TYPE_BUTTONS, remembered.deliveryType),
    labelOf(PAYMENT_METHOD_BUTTONS, remembered.paymentMethod),
    `Recibo: ${labelOf(RECEIPT_PREFERENCE_BUTTONS, remembered.receiptPreference)}`,
  ]

  /*
   * Logo abaixo da entrega, e completo: o endereço qualifica a entrega, e é o item em que um erro
   * custa a compra inteira — some numa linha truncada e o cliente confirma sem ter conferido.
   *
   * `formatAddressLine` entende os dois formatos porque `lastOrder.address` pode vir de um pedido de
   * ANTES de T2.2 (string crua) ou de DEPOIS (objeto estruturado) — sem isso, "repetir a última
   * compra" pararia de mostrar o endereço assim que o primeiro pedido estruturado fosse feito.
   */
  const addressLine = formatAddressLine(remembered.address)
  if (addressLine) lines.splice(1, 0, `📍 ${addressLine}`)

  return lines.map((line) => `• ${line}`).join('\n')
}
