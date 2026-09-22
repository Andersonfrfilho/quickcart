/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * As faixas de taxa por distância (T1.2 acrescenta `replaceAll`, usado pelo painel §3.6).
 */

/** "Até `maxDistanceKm` km, cobra `feeInCents`" — a faixa i cobre (X[i-1], X[i]]. */
export type DeliveryFeeTier = {
  readonly maxDistanceKm: number
  readonly feeInCents: number
}

export interface DeliveryFeeTierRepositoryInterface {
  /** Ordenadas por `maxDistanceKm` crescente; lista vazia = a loja não entrega. */
  listOrdered(): Promise<readonly DeliveryFeeTier[]>
  /**
   * Substitui a lista inteira numa transação (delete + insert) — o painel nunca edita uma faixa
   * isolada (design.md "Trade-offs aceitos"), então não há upsert por linha aqui.
   */
  replaceAll(tiers: readonly DeliveryFeeTier[]): Promise<void>
  /**
   * `true` depois que alguém (seed ou painel) já configurou as faixas — mesmo que a lista esteja
   * vazia. É o que distingue "nunca configurado" de "o lojista desligou a entrega".
   */
  hasBeenConfigured(): Promise<boolean>
  /** Grava o marcador sem mexer nas faixas; `replaceAll` já grava na mesma transação. */
  markConfigured(): Promise<void>
}
