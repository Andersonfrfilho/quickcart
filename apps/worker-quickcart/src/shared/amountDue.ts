/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Espelha apps/api-quickcart/src/modules/order/shared/amountDue.ts: os dois processos não compartilham
 * código, e o recibo simples precisa do valor cobrado. É a única soma itens + taxa do worker — a NFC-e
 * (FiscalReceiptProvider) nunca a usa, porque não admite frete e paga só `totalInCents`.
 */

export type AmountDueInCentsParams = {
  readonly totalInCents: number
  readonly deliveryFeeInCents: number
}

export function amountDueInCents(params: AmountDueInCentsParams): number {
  return params.totalInCents + params.deliveryFeeInCents
}
