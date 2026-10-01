/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A api junta todos os erros do PUT numa mensagem só, `"0.maxDistanceKm: ...; 1.feeInCents: ..."`
 * (`validateBody`, api-quickcart). `parseDeliveryFeeTiersErrorMessage` desfaz essa junção para a
 * tela apontar o erro NA LINHA — sem isto, o operador via um parágrafo de erro e tinha que adivinhar
 * qual das dez linhas da tabela ele descrevia.
 */

export const DELIVERY_FEE_TIERS_MAX_COUNT = 10

/** Índice da linha (0-based) → mensagens daquela linha. Erro sem índice numérico (ex.: tamanho da
 * lista) cai na chave `-1`, exibida como aviso geral da tabela. */
export type DeliveryFeeTiersRowErrors = ReadonlyMap<number, readonly string[]>

export function parseDeliveryFeeTiersErrorMessage(message: string): DeliveryFeeTiersRowErrors {
  const rows = new Map<number, string[]>()

  for (const part of message.split(';').map((entry) => entry.trim()).filter(Boolean)) {
    const match = /^(\d+)\.[^:]+:\s*(.+)$/.exec(part)
    const index = match ? Number(match[1]) : -1
    const text = match ? match[2] ?? part : part

    const existing = rows.get(index) ?? []
    existing.push(text)
    rows.set(index, existing)
  }

  return rows
}

/** "Fora de N km a loja não entrega" com a maior faixa, ou "Sem faixas, só retirada" sem nenhuma. */
export function resolveOutOfRangeWarning(tiers: readonly { readonly maxDistanceKm: number }[]): string {
  if (tiers.length === 0) return 'Sem faixas, só retirada.'

  const maxDistanceKm = Math.max(...tiers.map((tier) => tier.maxDistanceKm))
  return `Fora de ${maxDistanceKm} km a loja não entrega.`
}
