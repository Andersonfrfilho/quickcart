/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Builders puros de InteractiveListSection para categorias, produtos e
 * candidatos de desambiguação — compartilhados por MenuHandler/BrowseHandler
 * e ListHandler/ResolveHandler. Truncamento respeita os limites de row/section
 * title (24) e description (72) da WhatsApp Business API.
 */

import type { InteractiveListRow, InteractiveListSection } from '@adatechnology/whatsapp-provider'
import type { Category, Product } from '@/infra/database/schema'
import type { MatchCandidate } from '@/modules/conversation/application/types/MatchProducts.types'
import type { PendingResolution } from '@/modules/conversation/shared/ConversationContext.types'
import {
  BROWSE_ROW_ID,
  BROWSE_ROW_PREFIX,
  EDITING_CART_ROW_ID,
  EDITING_CART_ROW_PREFIX,
  RESOLVE_ROW_ID,
  RESOLVE_ROW_PREFIX,
} from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'

const LIST_ROW_TITLE_MAX_LENGTH = 24
const LIST_ROW_DESCRIPTION_MAX_LENGTH = 72
const LIST_SECTION_TITLE_MAX_LENGTH = 24

type PricedItem = {
  readonly name: string
  readonly brand?: string | null
  readonly unitSize?: string | null
  readonly priceInCents: number
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}

function buildItemDescription(item: PricedItem): string {
  const details = [item.brand, item.unitSize].filter((value): value is string => Boolean(value)).join(' · ')
  const price = formatPriceInCents(item.priceInCents)
  return truncate(details ? `${details} — ${price}` : price, LIST_ROW_DESCRIPTION_MAX_LENGTH)
}

export function buildCategorySection(categories: readonly Category[]): InteractiveListSection {
  const rows: InteractiveListRow[] = categories.map((category) => ({
    id: `${BROWSE_ROW_PREFIX.CATEGORY}${category.id}`,
    title: truncate(`${category.emoji ?? ''} ${category.name}`.trim(), LIST_ROW_TITLE_MAX_LENGTH),
  }))
  return { title: truncate('Categorias', LIST_SECTION_TITLE_MAX_LENGTH), rows }
}

export function buildProductSection(products: readonly Product[], hasNextPage: boolean): InteractiveListSection {
  const productRows: InteractiveListRow[] = products.map((product) => ({
    id: `${BROWSE_ROW_PREFIX.PRODUCT}${product.id}`,
    title: truncate(product.name, LIST_ROW_TITLE_MAX_LENGTH),
    description: buildItemDescription(product),
  }))
  const nextPageRow: InteractiveListRow = { id: BROWSE_ROW_ID.NEXT_PAGE, title: '➡️ Próxima página' }
  const rows = hasNextPage ? [...productRows, nextPageRow] : productRows
  return { title: truncate('Produtos', LIST_SECTION_TITLE_MAX_LENGTH), rows }
}

export type EditingCartRow = {
  readonly cartItemId: string
  readonly productName: string
  readonly quantity: number
  readonly priceInCents: number
}

export function buildEditingCartSection(rows: readonly EditingCartRow[]): InteractiveListSection {
  const itemRows: InteractiveListRow[] = rows.map((row) => ({
    id: `${EDITING_CART_ROW_PREFIX.ITEM}${row.cartItemId}`,
    title: truncate(`${row.quantity}x ${row.productName}`, LIST_ROW_TITLE_MAX_LENGTH),
    description: buildItemDescription({ name: row.productName, priceInCents: row.priceInCents * row.quantity }),
  }))
  const doneRow: InteractiveListRow = { id: EDITING_CART_ROW_ID.DONE, title: '✅ Concluir edição' }
  return { title: truncate('Seus itens', LIST_SECTION_TITLE_MAX_LENGTH), rows: [...itemRows, doneRow] }
}

export function buildResolveSection(pending: PendingResolution): InteractiveListSection {
  const candidateRows: InteractiveListRow[] = pending.candidates.map((candidate: MatchCandidate) => ({
    id: `${RESOLVE_ROW_PREFIX.PRODUCT}${candidate.productId}`,
    title: truncate(candidate.name, LIST_ROW_TITLE_MAX_LENGTH),
    description: buildItemDescription(candidate),
  }))
  const skipRow: InteractiveListRow = { id: RESOLVE_ROW_ID.SKIP_ITEM, title: '❌ Nenhum desses' }
  return {
    title: truncate(`Opções: ${pending.originalTerm}`, LIST_SECTION_TITLE_MAX_LENGTH),
    rows: [...candidateRows, skipRow],
  }
}
