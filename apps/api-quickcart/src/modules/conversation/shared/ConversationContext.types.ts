/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Fase 4 não tem tabelas `carts`/`cart_items` (chegam na Fase 5) — o carrinho
 * em progresso vive dentro de `conversation_sessions.context` (jsonb) até lá,
 * conforme spec §3.3.
 */

import type { MatchCandidate } from '@/modules/conversation/application/types/MatchProducts.types'

export type CartDraftItem = {
  readonly productId: string
  readonly name: string
  readonly priceInCents: number
  readonly quantity: number
  readonly matchType: 'auto' | 'selected' | 'manual'
  readonly originalTerm: string
}

export type PendingResolution = {
  readonly originalTerm: string
  readonly quantity: number
  readonly unit: string
  readonly candidates: readonly MatchCandidate[]
}

export type AwaitingQuantityProduct = {
  readonly productId: string
  readonly name: string
  readonly priceInCents: number
}

export type ConversationContext = {
  readonly cartDraft?: readonly CartDraftItem[]
  readonly unmatchedTerms?: readonly string[]
  readonly pendingResolutions?: readonly PendingResolution[]
  readonly browsingCategoryId?: string
  readonly browsingPage?: number
  readonly awaitingQuantityProduct?: AwaitingQuantityProduct
  readonly wasExpired?: boolean
  readonly editingCartItemId?: string
  readonly checkoutDeliveryType?: string
  readonly checkoutAddress?: unknown
  readonly checkoutPaymentMethod?: string
  readonly checkoutReceiptPreference?: string
  readonly checkoutEmail?: string
}
