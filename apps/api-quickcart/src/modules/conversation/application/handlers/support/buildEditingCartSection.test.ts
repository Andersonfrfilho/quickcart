/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import { WHATSAPP_CHOICE_LIMIT } from '@adatechnology/meta-whatsapp-contracts'
import {
  buildEditingCartSection,
  type EditingCartRow,
} from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { EDITING_CART_ROW_ID, EDITING_CART_ROW_PREFIX } from '@/modules/conversation/shared/Messages.constant'

function buildRows(count: number): EditingCartRow[] {
  return Array.from({ length: count }, (_, index) => ({
    cartItemId: `item-${index}`,
    productName: `Produto ${index}`,
    quantity: 1,
    priceInCents: 1_000 + index,
  }))
}

describe('buildEditingCartSection', () => {
  it('nunca passa do teto de linhas da Meta', () => {
    const section = buildEditingCartSection(buildRows(30), 1)

    expect(section.rows.length).toBeLessThanOrEqual(WHATSAPP_CHOICE_LIMIT.LIST_ROWS)
  })

  it('mostra a linha de próxima página só quando sobram itens', () => {
    const withMore = buildEditingCartSection(buildRows(30), 1)
    expect(withMore.rows.map((row) => row.id)).toContain(EDITING_CART_ROW_ID.NEXT_PAGE)

    const withoutMore = buildEditingCartSection(buildRows(3), 1)
    expect(withoutMore.rows.map((row) => row.id)).not.toContain(EDITING_CART_ROW_ID.NEXT_PAGE)
  })

  it('a última página é alcançável e contém os itens restantes', () => {
    const rows = buildRows(10)
    const firstPage = buildEditingCartSection(rows, 1)
    const firstPageItemIds = firstPage.rows
      .map((row) => row.id)
      .filter((id) => id.startsWith(EDITING_CART_ROW_PREFIX.ITEM))

    const secondPage = buildEditingCartSection(rows, 2)
    const secondPageItemIds = secondPage.rows
      .map((row) => row.id)
      .filter((id) => id.startsWith(EDITING_CART_ROW_PREFIX.ITEM))

    expect(secondPage.rows.map((row) => row.id)).not.toContain(EDITING_CART_ROW_ID.NEXT_PAGE)
    expect(secondPage.rows.map((row) => row.id)).toContain(EDITING_CART_ROW_ID.DONE)
    expect(firstPageItemIds.length + secondPageItemIds.length).toBe(rows.length)
    expect(new Set([...firstPageItemIds, ...secondPageItemIds]).size).toBe(rows.length)
  })

  it('mantém todos os itens quando cabem numa página só, com "Concluir edição" ao final', () => {
    const section = buildEditingCartSection(buildRows(2), 1)

    expect(section.rows.map((row) => row.id).at(-1)).toBe(EDITING_CART_ROW_ID.DONE)
  })

  it('a linha de página anterior só aparece a partir da segunda página', () => {
    const rows = buildRows(10)

    const firstPage = buildEditingCartSection(rows, 1)
    expect(firstPage.rows.map((row) => row.id)).not.toContain(EDITING_CART_ROW_ID.PREVIOUS_PAGE)

    const secondPage = buildEditingCartSection(rows, 2)
    expect(secondPage.rows.map((row) => row.id)).toContain(EDITING_CART_ROW_ID.PREVIOUS_PAGE)
  })

  it('ida e volta bate na mesma primeira página (round-trip)', () => {
    const rows = buildRows(10)

    const firstPage = buildEditingCartSection(rows, 1)
    const backToFirstPage = buildEditingCartSection(rows, 1)

    expect(backToFirstPage.rows).toEqual(firstPage.rows)
  })
})
