/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * As linhas de "o que você quer mudar?", montadas a partir do que está lembrado.
 *
 * Cada linha mostra o valor atual na descrição: a lista responde "o que dá para mudar" e "o que está
 * valendo agora" de uma vez, e assim o cliente que só queria conferir não precisa abrir item nenhum.
 */

import type { RememberedCheckout } from '@/modules/conversation/application/rememberedCheckout'
import { formatAddressLine } from '@/modules/shared/address/formatAddressLine'
import {
  CHECKOUT_CHANGE_ROW_ID,
  DELIVERY_TYPE_BUTTONS,
  DELIVERY_TYPE_BUTTON_ID,
  PAYMENT_METHOD_BUTTONS,
  RECEIPT_PREFERENCE_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'

export type CheckoutChangeRow = {
  readonly id: string
  readonly title: string
  readonly description?: string
}

function labelOf(buttons: readonly { readonly id: string; readonly title: string }[], id: string): string {
  return buttons.find((button) => button.id === id)?.title ?? id
}

/** WhatsApp corta a descrição da linha; cortar aqui deixa o fim visível em vez de reticências do app. */
const ROW_DESCRIPTION_LIMIT = 72

function trim(text: string): string {
  return text.length <= ROW_DESCRIPTION_LIMIT ? text : `${text.slice(0, ROW_DESCRIPTION_LIMIT - 1)}…`
}

export function buildCheckoutChangeRows(remembered: RememberedCheckout): readonly CheckoutChangeRow[] {
  const rows: CheckoutChangeRow[] = [
    {
      id: CHECKOUT_CHANGE_ROW_ID.DELIVERY_TYPE,
      title: '🚚 Entrega ou retirada',
      description: trim(labelOf(DELIVERY_TYPE_BUTTONS, remembered.deliveryType)),
    },
  ]

  // Endereço só existe na entrega: oferecer "mudar o endereço" a quem vai retirar na loja é oferecer
  // uma pergunta sem resposta possível.
  if (remembered.deliveryType === DELIVERY_TYPE_BUTTON_ID.DELIVERY) {
    const addressLine = formatAddressLine(remembered.address)
    rows.push({
      id: CHECKOUT_CHANGE_ROW_ID.ADDRESS,
      title: '📍 Endereço',
      ...(addressLine ? { description: trim(addressLine) } : {}),
    })
  }

  rows.push({
    id: CHECKOUT_CHANGE_ROW_ID.PAYMENT,
    title: '💳 Pagamento',
    description: trim(labelOf(PAYMENT_METHOD_BUTTONS, remembered.paymentMethod)),
  })

  rows.push({
    id: CHECKOUT_CHANGE_ROW_ID.RECEIPT,
    title: '🧾 Recibo',
    description: trim(labelOf(RECEIPT_PREFERENCE_BUTTONS, remembered.receiptPreference)),
  })

  rows.push({ id: CHECKOUT_CHANGE_ROW_ID.NONE, title: '↩️ Deixa como está' })

  return rows
}
