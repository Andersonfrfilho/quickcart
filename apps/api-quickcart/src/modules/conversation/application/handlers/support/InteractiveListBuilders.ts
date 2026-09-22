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

import type { InteractiveListRow, InteractiveListSection } from '@adatechnology/meta-whatsapp-provider'
import { WHATSAPP_CHOICE_LIMIT } from '@adatechnology/meta-whatsapp-contracts'
import type { Category } from '@/infra/database/schema'
import type { MatchCandidate } from '@/modules/conversation/application/types/MatchProducts.types'
import type { PendingResolution } from '@/modules/conversation/shared/ConversationContext.types'
import { paginateRows } from '@/modules/conversation/application/handlers/support/paginateRows'
import {
  MESSAGES,
  BROWSE_ROW_ID,
  BROWSE_ROW_PREFIX,
  EDITING_CART_ROW_ID,
  EDITING_CART_ROW_PREFIX,
  NEXT_PAGE_ROW_TITLE,
  RESOLVE_ROW_ID,
  RESOLVE_ROW_PREFIX,
} from '@/modules/conversation/shared/Messages.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'

const FIRST_PAGE = 1

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

/** Só o que a linha exibe: vale tanto para a página da categoria quanto para o resultado da busca. */
type ProductRowSource = PricedItem & { readonly id: string }

export function buildProductSection(
  products: readonly ProductRowSource[],
  hasNextPage: boolean,
  /** Paginação de categoria e busca por texto livre avançam de formas diferentes — precisam de ids distintos. */
  nextPageRowId: string = BROWSE_ROW_ID.NEXT_PAGE,
): InteractiveListSection {
  const productRows: InteractiveListRow[] = products.map((product) => ({
    id: `${BROWSE_ROW_PREFIX.PRODUCT}${product.id}`,
    title: truncate(product.name, LIST_ROW_TITLE_MAX_LENGTH),
    description: buildItemDescription(product),
  }))
  const nextPageRow: InteractiveListRow = { id: nextPageRowId, title: NEXT_PAGE_ROW_TITLE }
  const rows = hasNextPage ? [...productRows, nextPageRow] : productRows
  return { title: truncate('Produtos', LIST_SECTION_TITLE_MAX_LENGTH), rows }
}

export type EditingCartRow = {
  readonly cartItemId: string
  readonly productName: string
  readonly quantity: number
  readonly priceInCents: number
}

/** Linhas fixas da seção (concluir + próxima página reservada) descontadas do teto de 10 rows da Meta. */
const EDITING_CART_FIXED_ROWS = 2
const EDITING_CART_ITEMS_PER_PAGE = WHATSAPP_CHOICE_LIMIT.LIST_ROWS - EDITING_CART_FIXED_ROWS

export function buildEditingCartSection(rows: readonly EditingCartRow[], page: number = FIRST_PAGE): InteractiveListSection {
  const { pageItems, hasNextPage } = paginateRows({ items: rows, page, itemsPerPage: EDITING_CART_ITEMS_PER_PAGE })

  const itemRows: InteractiveListRow[] = pageItems.map((row) => ({
    id: `${EDITING_CART_ROW_PREFIX.ITEM}${row.cartItemId}`,
    title: truncate(`${row.quantity}x ${row.productName}`, LIST_ROW_TITLE_MAX_LENGTH),
    description: buildItemDescription({ name: row.productName, priceInCents: row.priceInCents * row.quantity }),
  }))
  const doneRow: InteractiveListRow = { id: EDITING_CART_ROW_ID.DONE, title: '✅ Concluir edição' }
  const nextPageRow: InteractiveListRow = { id: EDITING_CART_ROW_ID.NEXT_PAGE, title: NEXT_PAGE_ROW_TITLE }
  const trailingRows = hasNextPage ? [doneRow, nextPageRow] : [doneRow]

  return { title: truncate('Seus itens', LIST_SECTION_TITLE_MAX_LENGTH), rows: [...itemRows, ...trailingRows] }
}

/**
 * Candidatos que só diferem pela marca — mesmo nome de produto, mesmo tamanho.
 *
 * É o caso comum de supermercado: "leite" casa com três `Leite Integral 1L` de marcas diferentes.
 * Reconhecer isso é o que permite oferecer "tanto faz" sem risco: a delegação troca de marca, não de
 * produto. Entre `Leite Integral 1L` e `Leite em Pó 400g` a resposta é falsa, e a linha não aparece.
 */
export function areCandidatesInterchangeable(candidates: readonly MatchCandidate[]): boolean {
  if (candidates.length < 2) return false

  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  const [first, ...rest] = candidates
  if (!first) return false

  return rest.every(
    (candidate) =>
      normalize(candidate.name) === normalize(first.name) &&
      (candidate.unitSize ?? '') === (first.unitSize ?? ''),
  )
}

/** O mais barato entre os candidatos. Usado pela linha de delegação, nunca em silêncio. */
export function cheapestCandidate(candidates: readonly MatchCandidate[]): MatchCandidate | undefined {
  return candidates.reduce<MatchCandidate | undefined>(
    (cheapest, candidate) => (!cheapest || candidate.priceInCents < cheapest.priceInCents ? candidate : cheapest),
    undefined,
  )
}

export function buildResolveSection(pending: PendingResolution): InteractiveListSection {
  const delegateRows: InteractiveListRow[] = areCandidatesInterchangeable(pending.candidates)
    ? [{ id: RESOLVE_ROW_ID.CHEAPEST, title: MESSAGES.RESOLVE_CHEAPEST_LABEL }]
    : []
  const skipRow: InteractiveListRow = { id: RESOLVE_ROW_ID.SKIP_ITEM, title: '❌ Nenhum desses' }
  const nextPageRow: InteractiveListRow = { id: RESOLVE_ROW_ID.NEXT_PAGE, title: NEXT_PAGE_ROW_TITLE }

  /**
   * "Tanto faz" e "Nenhum desses" ocupam a página inteira; a próxima página reserva mais uma
   * linha sempre — mesmo na última, que não a usa — para o slice de candidatos não mudar de página para página.
   */
  const candidatesPerPage = WHATSAPP_CHOICE_LIMIT.LIST_ROWS - delegateRows.length - 2
  const page = pending.page ?? FIRST_PAGE
  const { pageItems, hasNextPage } = paginateRows({ items: pending.candidates, page, itemsPerPage: candidatesPerPage })

  /** Candidatos mantêm ordem de relevância entre páginas; dentro da página, o mais barato aparece primeiro. */
  const orderedPageCandidates = [...pageItems].sort((left, right) => left.priceInCents - right.priceInCents)

  const candidateRows: InteractiveListRow[] = orderedPageCandidates.map((candidate: MatchCandidate) => ({
    id: `${RESOLVE_ROW_PREFIX.PRODUCT}${candidate.productId}`,
    title: truncate(candidate.name, LIST_ROW_TITLE_MAX_LENGTH),
    description: buildItemDescription(candidate),
  }))

  const trailingRows = hasNextPage ? [...delegateRows, skipRow, nextPageRow] : [...delegateRows, skipRow]

  return {
    title: truncate(`Opções: ${pending.originalTerm}`, LIST_SECTION_TITLE_MAX_LENGTH),
    rows: [...candidateRows, ...trailingRows],
  }
}
