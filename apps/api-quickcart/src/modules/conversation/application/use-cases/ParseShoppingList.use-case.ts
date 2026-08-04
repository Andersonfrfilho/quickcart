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
/**
 * Números por extenso, de um a doze.
 *
 * Ia até três, e quem MANDA ÁUDIO fala por extenso: "seis ovos" caía no fallback, virava o termo
 * `seis ovos` com quantidade 1 e não casava com nada — nem no catálogo, nem como apelido, e ainda
 * entrava no relatório de demanda como se o cliente tivesse pedido um produto chamado "seis ovos".
 *
 * Para em doze porque acima disso a pessoa volta a usar algarismo, e "cem" em compra de supermercado
 * aparece mais em "cem gramas" (que as regras de unidade já pegam) do que contando item.
 *
 * Alternativas com "duzia" vêm antes de "uma?" — alternação regex tenta da esquerda pra direita e para
 * na primeira que casar, então "uma?" sozinho intercetaria "uma duzia".
 */
const SPELLED_OUT_NUMBER =
  /^(meia\s+d[uú]zia|uma\s+d[uú]zia|duas\s+d[uú]zias|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|tr[eê]s|duas|dois|uma?)\s+(.+)$/i
// Última regra antes do fallback: número solto sem palavra de unidade (ex: "6 ovos",
// "3 bananas") — sem ela, o dígito ficava preso ao termo e a quantidade virava 1.
const BARE_COUNT_LEADING = /^(\d+)\s+(.+)$/
const LEADING_PREPOSITION = /^(?:de|do|da)\s+/

/**
 * Unidade que sobra depois de um número ESCRITO: "dois pacotes de modess", "um litro de leite".
 *
 * As regras de dígito já separam a unidade ("2 kg de arroz" vira `arroz`), mas a de número escrito
 * jogava todo o resto no termo — e quem manda áudio fala "dois pacotes", não "2 pct". O resultado eram
 * termos como `pacotes de modess`, que não casam com o catálogo, entopem o relatório de demanda com
 * uma linha por embalagem e, pior, tornam o apelido inútil: ninguém cadastra "pacotes de modess" como
 * apelido de um produto.
 */
const LEADING_UNIT_AFTER_SPELLED_NUMBER =
  /^(kg|g|l|ml|litros?|quilos?|gramas?|un|unidades?|pacotes?|caixas?|latas?|garrafas?|potes?|bandejas?|sacos?|fardos?|d[uú]zias?)\s+(.+)$/i

/**
 * Pontuação no fim do termo, que a transcrição sempre traz: "…e um litro de leite." vira `leite.`
 *
 * Não é só estética — o termo vai para a pergunta de desambiguação ("mais de uma opção para
 * 'leite.'") e para a lista do que não foi encontrado, e é usado no casamento contra o catálogo, onde
 * um ponto a mais é diferença que não deveria existir.
 */
const TRAILING_PUNCTUATION = /[.,;:!?]+$/

const SPELLED_NUMBER_QUANTITY: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  'meia duzia': 6,
  'uma duzia': 12,
  'duas duzias': 24,
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

/**
 * Verbo de intenção no começo do segmento: "QUERO 3 quilos de feijão".
 *
 * Todas as regexes de `extractItem` estão ancoradas no início do segmento, então uma palavra na
 * frente derrubava todas e o segmento caía no caso final — termo com o verbo colado
 * ("quero 3 quilos de feijao") e **quantidade 1**, perdendo os 3 quilos que o cliente pediu.
 *
 * Isso ficou comum com nota de voz: escrevendo as pessoas mandam "3 kg de feijão", falando dizem
 * "quero 3 quilos de feijão" — e a transcrição é fiel. O estrago era duplo: pedido com quantidade
 * errada, e o relatório de demanda do lojista poluído com "quero 3 quilos de feijao" como termo.
 *
 * Alternativas mais longas primeiro, senão `quero` casaria antes de `quero comprar` e sobraria
 * "comprar 3 quilos". O `\s+` no fim é obrigatório para não cortar produto que começa com o verbo —
 * "queijo" não vira "jo" — e o `$` cobre o segmento que é só o verbo, como em "quero, 2 litros de leite".
 */
const LEADING_INTENT_PHRASE =
  /^(?:eu\s+)?(?:quero\s+comprar|vou\s+querer|me\s+manda|me\s+ve|gostaria|preciso|precisava|quero|queria|manda|mande|traz|traga|coloca|adiciona|poe|bota)(?:\s+de|\s+comprar)?(?:\s+|$)/

function stripLeadingIntent(segment: string): string {
  return segment.replace(LEADING_INTENT_PHRASE, '').trim()
}

function parseQuantity(rawQuantity: string): number {
  return Number.parseFloat(rawQuantity.replace(',', '.'))
}

function cleanTerm(rawTerm: string): string {
  return rawTerm.trim().replace(LEADING_PREPOSITION, '').replace(TRAILING_PUNCTUATION, '').trim()
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

    // "dois PACOTES de modess": a unidade é dela, não do termo.
    const unitMatch = term.match(LEADING_UNIT_AFTER_SPELLED_NUMBER)
    if (unitMatch) {
      return { term: cleanTerm(unitMatch[2]!), quantity, unit: unitMatch[1]!.toLowerCase() }
    }

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
  return segmentText(normalizedText)
    .map(stripLeadingIntent)
    // Segmento que era só o verbo ("quero" sozinho) não é item — sobra string vazia e sai daqui.
    .filter((segment) => segment.length > 0)
    .map(extractItem)
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
