/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Tradução do contexto da sessão para o painel "Suas Seleções". O SDK não sabe — nem deve saber —
 * o que `menuChoice` significa: as chaves são do fluxo do QuickCart, então a nomeação mora aqui.
 */

import type { ConversationContextEntry } from '@adatechnology/conversations-ui'

const CONTEXT_LABELS: ReadonlyArray<{ key: string; label: string; icon: string }> = [
  { key: 'customerName', label: 'Nome', icon: '👤' },
  { key: 'menuChoice', label: 'Escolha no menu', icon: '🗂️' },
  { key: 'deliveryType', label: 'Entrega', icon: '🛵' },
  { key: 'address', label: 'Endereço', icon: '📍' },
  { key: 'paymentMethod', label: 'Pagamento', icon: '💳' },
  { key: 'receiptPreference', label: 'Recibo', icon: '🧾' },
]

function asDisplayValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function toContextEntries(context: Record<string, unknown> | undefined): ConversationContextEntry[] {
  const source = context ?? {}

  // Chaves conhecidas primeiro, na ordem do fluxo; o resto entra depois com o nome cru, para que
  // um campo novo do motor apareça no painel sem esperar deploy do frontend.
  const known = CONTEXT_LABELS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: entry.icon,
    value: asDisplayValue(source[entry.key]),
  }))

  const knownKeys = new Set(CONTEXT_LABELS.map((entry) => entry.key))
  const extra = Object.keys(source)
    .filter((key) => !knownKeys.has(key))
    .map((key) => ({ key, label: key, icon: '•', value: asDisplayValue(source[key]) }))

  return [...known, ...extra]
}
