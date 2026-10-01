/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A taxa de entrega fica FORA de `total_in_cents` (spec §3.4): a NFC-e usa o total como pagamento e não
 * admite frete. Por isso a soma "itens + taxa" vive só aqui — nenhum outro lugar soma.
 * Recebe um objeto simples, e não um pedido, para o resumo e o troco poderem chamar antes de o pedido existir.
 *
 * A taxa em si não é mais resolvida aqui: `QuoteDeliveryFee` é o único cálculo (spec §3.3, taxa por
 * faixa de distância) — este arquivo só soma o que já foi cotado.
 */

export type AmountDueInCentsParams = {
  readonly totalInCents: number
  readonly deliveryFeeInCents: number
}

export function amountDueInCents(params: AmountDueInCentsParams): number {
  return params.totalInCents + params.deliveryFeeInCents
}
