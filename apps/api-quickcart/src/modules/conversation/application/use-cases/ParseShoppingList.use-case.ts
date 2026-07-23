/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Algoritmo fechado na spec §3.1 — cascata de regex nesta ordem exata (primeiro que
 * casar vence), com Groq como refinador opcional que nunca é uma dependência dura.
 */

import type { ListRefinerProvider } from '@/modules/conversation/application/providers/ListRefinerProvider.interface'
import type {
  ParsedListItem,
  ParseShoppingListParams,
  ParseShoppingListResult,
} from '@/modules/conversation/application/types/ParseShoppingList.types'

const BULLET_OR_NUMBERING_PREFIX = /^\s*(?:[-*•]|\d+[.)])\s*/
// Lookaround evita quebrar "1,5kg" (vírgula decimal) ao segmentar a lista — só
// trata a vírgula como separador de itens quando não está entre dois dígitos.
const SEGMENT_SEPARATOR = /\s*(?:(?<!\d),(?!\d)|;|\se\s)\s*/

const WEIGHT_UNIT_LEADING = /^(\d+[.,]?\d*)\s*(kg|g|l|ml|litros?|quilos?|gramas?)\s+(.+)$/i
const COUNT_UNIT_LEADING = /^(\d+)\s*(x|un|unidades?|pacotes?|caixas?|latas?|dz|d[uú]zias?)\s+(.+)$/i
const WEIGHT_UNIT_TRAILING = /^(.+?)\s+(\d+[.,]?\d*)\s*(kg|g|l|ml|un)$/i
// Alternativas com "duzia" vêm antes de "uma?" — alternação regex tenta da esquerda pra
// direita e para na primeira que casar, então "uma?" sozinho intercetaria "uma duzia".
const SPELLED_OUT_NUMBER = /^(meia\s+d[uú]zia|uma\s+d[uú]zia|tr[eê]s|duas|dois|uma?)\s+(.+)$/i
// Última regra antes do fallback: número solto sem palavra de unidade (ex: "6 ovos",
// "3 bananas") — sem ela, o dígito ficava preso ao termo e a quantidade virava 1.
const BARE_COUNT_LEADING = /^(\d+)\s+(.+)$/
const LEADING_PREPOSITION = /^(?:de|do|da)\s+/

const SPELLED_NUMBER_QUANTITY: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  'meia duzia': 6,
  'uma duzia': 12,
}

const FALLBACK_UNIT = 'un'
const FALLBACK_QUANTITY = 1

const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(COMBINING_DIACRITICAL_MARKS, '')
}

function normalizeText(rawText: string): string {
  return stripDiacritics(rawText.toLowerCase()).replace(/[ \t]+/g, ' ')
}

function segmentText(normalizedText: string): readonly string[] {
  return normalizedText
    .split('\n')
    .map((line) => line.replace(BULLET_OR_NUMBERING_PREFIX, '').trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => line.split(SEGMENT_SEPARATOR))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

function parseQuantity(rawQuantity: string): number {
  return Number.parseFloat(rawQuantity.replace(',', '.'))
}

function cleanTerm(rawTerm: string): string {
  return rawTerm.trim().replace(LEADING_PREPOSITION, '').trim()
}

// Grupos de captura das regexes acima nunca são opcionais quando o match ocorre —
// as asserções abaixo refletem essa garantia, não uma suposição sobre input externo.
function extractItem(segment: string): ParsedListItem {
  const weightLeadingMatch = segment.match(WEIGHT_UNIT_LEADING)
  if (weightLeadingMatch) {
    const quantity = weightLeadingMatch[1]!
    const unit = weightLeadingMatch[2]!
    const term = weightLeadingMatch[3]!
    return { term: cleanTerm(term), quantity: parseQuantity(quantity), unit: unit.toLowerCase() }
  }

  const countLeadingMatch = segment.match(COUNT_UNIT_LEADING)
  if (countLeadingMatch) {
    const quantity = countLeadingMatch[1]!
    const unit = countLeadingMatch[2]!
    const term = countLeadingMatch[3]!
    return { term: cleanTerm(term), quantity: parseQuantity(quantity), unit: unit.toLowerCase() }
  }

  const weightTrailingMatch = segment.match(WEIGHT_UNIT_TRAILING)
  if (weightTrailingMatch) {
    const term = weightTrailingMatch[1]!
    const quantity = weightTrailingMatch[2]!
    const unit = weightTrailingMatch[3]!
    return { term: cleanTerm(term), quantity: parseQuantity(quantity), unit: unit.toLowerCase() }
  }

  const spelledOutMatch = segment.match(SPELLED_OUT_NUMBER)
  if (spelledOutMatch) {
    const spelledNumber = spelledOutMatch[1]!
    const term = spelledOutMatch[2]!
    const normalizedSpelledNumber = spelledNumber.toLowerCase().replace(/\s+/g, ' ')
    const quantity = SPELLED_NUMBER_QUANTITY[normalizedSpelledNumber] ?? FALLBACK_QUANTITY
    return { term: cleanTerm(term), quantity, unit: FALLBACK_UNIT }
  }

  const bareCountMatch = segment.match(BARE_COUNT_LEADING)
  if (bareCountMatch) {
    const quantity = bareCountMatch[1]!
    const term = bareCountMatch[2]!
    return { term: cleanTerm(term), quantity: parseQuantity(quantity), unit: FALLBACK_UNIT }
  }

  return { term: cleanTerm(segment), quantity: FALLBACK_QUANTITY, unit: FALLBACK_UNIT }
}

function parseWithRegex(rawText: string): readonly ParsedListItem[] {
  const normalizedText = normalizeText(rawText)
  return segmentText(normalizedText).map(extractItem)
}

export class ParseShoppingListUseCase {
  constructor(private readonly listRefinerProvider: ListRefinerProvider) {}

  async execute(params: ParseShoppingListParams): Promise<ParseShoppingListResult> {
    const regexItems = parseWithRegex(params.rawText)
    if (regexItems.length === 0) return { items: [], refinedByGroq: false }

    const refinedItems = await this.listRefinerProvider.refine(params.rawText, regexItems)
    if (refinedItems && refinedItems.length > 0) {
      return { items: refinedItems, refinedByGroq: true }
    }

    return { items: regexItems, refinedByGroq: false }
  }
}
