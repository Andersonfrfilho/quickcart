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
import type { KnownBrandsProvider } from '@/modules/conversation/application/providers/KnownBrandsProvider.interface'
import type {
  ParsedListItem,
  ParseShoppingListParams,
  ParseShoppingListResult,
} from '@/modules/conversation/application/types/ParseShoppingList.types'
import { normalizeBrand } from '@/modules/conversation/shared/normalizeBrand'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const BULLET_OR_NUMBERING_PREFIX = /^\s*(?:[-*•]|\d+[.)])\s*/
/**
 * Separadores de item. O ponto final entra porque a transcrição de fala termina frase no meio da
 * lista ("feijão de 2 kg. Também quero sal") — sem ele, os dois itens viravam um termo só.
 * Os lookarounds preservam o número decimal ditado ("1,5kg", "1.5kg").
 */
const SEGMENT_SEPARATOR = /\s*(?:(?<!\d)[,.](?!\d)|[;!?]|\se\s)\s*/
// Conjunção que sobra quando a vírgula já cortou o item: ", e açúcar" virava o termo `e acucar`.
const LEADING_CONJUNCTION = /^(?:e|ou)\s+/

/**
 * Listas de unidade compartilhadas entre as regexes "com produto" (LEADING) e as
 * "só quantidade" (ONLY, § órfão): construir os dois padrões a partir da mesma string
 * evita que um ganhe uma unidade nova e o outro fique para trás.
 */
const WEIGHT_UNIT_PATTERN = 'kg|g|l|ml|litros?|quilos?|gramas?'
const COUNT_UNIT_PATTERN = 'x|un|unidades?|pacotes?|caixas?|latas?|dz|d[uú]zias?'
const SPELLED_UNIT_PATTERN =
  'kg|g|l|ml|litros?|quilos?|gramas?|un|unidades?|pacotes?|caixas?|latas?|garrafas?|potes?|bandejas?|sacos?|fardos?|d[uú]zias?'
/**
 * Números por extenso, de um a doze, na mesma ordem usada pelo `SPELLED_OUT_NUMBER` de sempre.
 *
 * Alternativas com "duzia" vêm antes de "uma?" — alternação regex tenta da esquerda pra direita e
 * para na primeira que casar, então "uma?" sozinho intercetaria "uma duzia".
 */
const SPELLED_NUMBER_PATTERN =
  'meia\\s+d[uú]zia|uma\\s+d[uú]zia|duas\\s+d[uú]zias|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|tr[eê]s|duas|dois|uma?'

const WEIGHT_UNIT_LEADING = new RegExp(`^(\\d+[.,]?\\d*)\\s*(${WEIGHT_UNIT_PATTERN})\\s+(.+)$`, 'i')
const COUNT_UNIT_LEADING = new RegExp(`^(\\d+)\\s*(${COUNT_UNIT_PATTERN})\\s+(.+)$`, 'i')
// O `de` opcional é de "arroz DE 5kg": sem ele, a preposição ficava colada no fim do termo.
const WEIGHT_UNIT_TRAILING = /^(.+?)\s+(?:de\s+)?(\d+[.,]?\d*)\s*(kg|g|l|ml|un)$/i
/**
 * Fim de item sem separador: "arroz de 5kg feijao". Quem fala não pontua, e a transcrição sai sem a
 * vírgula entre um item e outro — sem este corte, "arroz de 5kg feijao" virava um termo só. Peso com
 * unidade seguido de mais palavra fecha o item da esquerda. Só com produto ANTES do número, e nunca
 * antes de "de": "5 kg de feijao" e "5kg arroz" são um item só.
 */
const QUANTITY_ENDS_ITEM = new RegExp(
  `(?<=\\p{L}\\s+(?:de\\s+)?\\d+(?:[.,]\\d+)?\\s*(?:${WEIGHT_UNIT_PATTERN}))\\s+(?!(?:de|do|da)\\s)(?=\\p{L})`,
  'iu',
)
/**
 * Números por extenso, de um a doze.
 *
 * Ia até três, e quem MANDA ÁUDIO fala por extenso: "seis ovos" caía no fallback, virava o termo
 * `seis ovos` com quantidade 1 e não casava com nada — nem no catálogo, nem como apelido, e ainda
 * entrava no relatório de demanda como se o cliente tivesse pedido um produto chamado "seis ovos".
 *
 * Para em doze porque acima disso a pessoa volta a usar algarismo, e "cem" em compra de supermercado
 * aparece mais em "cem gramas" (que as regras de unidade já pegam) do que contando item.
 */
const SPELLED_OUT_NUMBER = new RegExp(`^(${SPELLED_NUMBER_PATTERN})\\s+(.+)$`, 'i')
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
const LEADING_UNIT_AFTER_SPELLED_NUMBER = new RegExp(`^(${SPELLED_UNIT_PATTERN})\\s+(.+)$`, 'i')

/**
 * As três variantes "-ONLY": o segmento inteiro é quantidade+unidade, sem produto nenhum —
 * "2kg", "5 quilos", "dois quilos", "meia duzia", "3 pacotes". Usadas para reconhecer o item
 * órfão que o Whisper separa com vírgula ("arroz, 2kg") e que pertence ao item anterior, não é
 * um produto novo. A unidade é opcional em `SPELLED_OUT_NUMBER_ONLY` porque "meia duzia" já
 * contém a unidade dentro do próprio número por extenso.
 */
const WEIGHT_UNIT_ONLY = new RegExp(`^(\\d+[.,]?\\d*)\\s*(${WEIGHT_UNIT_PATTERN})$`, 'i')
const COUNT_UNIT_ONLY = new RegExp(`^(\\d+)\\s*(${COUNT_UNIT_PATTERN})$`, 'i')
const SPELLED_OUT_NUMBER_ONLY = new RegExp(`^(${SPELLED_NUMBER_PATTERN})(?:\\s+(${SPELLED_UNIT_PATTERN}))?$`, 'i')

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

const parseShoppingListLog = logger.child('ParseShoppingListUseCase')

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
    .flatMap((segment) => segment.split(QUANTITY_ENDS_ITEM))
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
  // "tambem" antes do verbo é comum em fala ("Também quero sal") e derrubava o reconhecimento.
  /^(?:tambem\s+)?(?:eu\s+)?(?:quero\s+comprar|vou\s+querer|me\s+manda|me\s+ve|gostaria|preciso|precisava|quero|queria|manda|mande|traz|traga|coloca|adiciona|poe|bota)(?:\s+de|\s+comprar)?(?:\s+|$)/

function stripLeadingIntent(segment: string): string {
  return segment.replace(LEADING_CONJUNCTION, '').replace(LEADING_INTENT_PHRASE, '').trim()
}

function parseQuantity(rawQuantity: string): number {
  return Number.parseFloat(rawQuantity.replace(',', '.'))
}

function cleanTerm(rawTerm: string): string {
  return rawTerm.trim().replace(LEADING_PREPOSITION, '').replace(TRAILING_PUNCTUATION, '').trim()
}

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

type QuantityOnlyMatch = {
  readonly quantity: number
  readonly unit: string
}

/** `undefined` quando o segmento tem produto, não é só quantidade — cai no `extractItem` normal. */
function matchQuantityOnly(segment: string): QuantityOnlyMatch | undefined {
  const candidate = segment.replace(TRAILING_PUNCTUATION, '').trim()

  const weightOnlyMatch = candidate.match(WEIGHT_UNIT_ONLY)
  if (weightOnlyMatch) return { quantity: parseQuantity(weightOnlyMatch[1]!), unit: weightOnlyMatch[2]!.toLowerCase() }

  const countOnlyMatch = candidate.match(COUNT_UNIT_ONLY)
  if (countOnlyMatch) return { quantity: parseQuantity(countOnlyMatch[1]!), unit: countOnlyMatch[2]!.toLowerCase() }

  const spelledOnlyMatch = candidate.match(SPELLED_OUT_NUMBER_ONLY)
  if (spelledOnlyMatch) {
    const normalizedSpelledNumber = spelledOnlyMatch[1]!.toLowerCase().replace(/\s+/g, ' ')
    const quantity = SPELLED_NUMBER_QUANTITY[normalizedSpelledNumber] ?? FALLBACK_QUANTITY
    const unit = spelledOnlyMatch[2] ? spelledOnlyMatch[2].toLowerCase() : FALLBACK_UNIT
    return { quantity, unit }
  }

  return undefined
}

function isFallbackQuantity(item: ParsedListItem): boolean {
  return item.quantity === FALLBACK_QUANTITY && item.unit === FALLBACK_UNIT
}

/**
 * Resolve, em uma passada só da esquerda para a direita, os dois jeitos que o Whisper quebra um
 * item em segmentos separados por vírgula: "arroz, broto legal" (marca do produto anterior) e
 * "arroz, 2kg" (quantidade do produto anterior). Um segmento não é as duas coisas ao mesmo tempo,
 * então a ordem entre os dois `if` não importa.
 */
function buildItemsFromSegments(segments: readonly string[], knownBrands: ReadonlySet<string>): ParsedListItem[] {
  const items: ParsedListItem[] = []

  for (const segment of segments) {
    const quantityOnly = matchQuantityOnly(segment)
    if (quantityOnly) {
      const previousIndex = items.length - 1
      const previous = items[previousIndex]
      /**
       * Só reaplica quando o item anterior ainda está na quantidade-fallback (1 un): se ele já tem
       * quantidade explícita, a vírgula seguinte não é dele — "3 pacotes de bolacha, 2kg" são dois
       * itens de verdade, e a segunda quantidade não deveria sobrescrever a primeira. Sem item
       * anterior, ou com o anterior já resolvido, o órfão não é produto — é descartado.
       */
      if (previous && isFallbackQuantity(previous)) {
        items[previousIndex] = { ...previous, quantity: quantityOnly.quantity, unit: quantityOnly.unit }
      }
      continue
    }

    const brandCandidate = normalizeBrand(segment)
    if (knownBrands.has(brandCandidate)) {
      const previousIndex = items.length - 1
      const previous = items[previousIndex]
      if (previous) {
        items[previousIndex] = { ...previous, term: `${previous.term} ${brandCandidate}`.trim() }
        continue
      }
      // Sem item anterior, a marca pode ser o pedido inteiro — "me manda broto legal" — vira termo próprio.
      items.push({ term: brandCandidate, quantity: FALLBACK_QUANTITY, unit: FALLBACK_UNIT })
      continue
    }

    items.push(extractItem(segment))
  }

  return items
}

function parseWithRegex(params: { rawText: string; knownBrands: ReadonlySet<string> }): readonly ParsedListItem[] {
  const { rawText, knownBrands } = params
  const normalizedText = normalizeText(rawText)
  const segments = segmentText(normalizedText)
    .map(stripLeadingIntent)
    .filter((segment) => segment.length > 0)

  return buildItemsFromSegments(segments, knownBrands)
}

export class ParseShoppingListUseCase {
  constructor(
    private readonly listRefinerProvider: ListRefinerProvider,
    private readonly knownBrandsProvider: KnownBrandsProvider,
  ) {}

  async execute(params: ParseShoppingListParams): Promise<ParseShoppingListResult> {
    const knownBrands = await this.resolveKnownBrands()
    const regexItems = parseWithRegex({ rawText: params.rawText, knownBrands })
    if (regexItems.length === 0) return { items: [], refinedByGroq: false }

    const refinedItems = await this.listRefinerProvider.refine(params.rawText, regexItems)
    if (refinedItems && refinedItems.length > 0) {
      return { items: refinedItems, refinedByGroq: true }
    }

    return { items: regexItems, refinedByGroq: false }
  }

  /** Nunca deixa a lista de marcas derrubar o parser — sem elas, só perde o merge de marca. */
  private async resolveKnownBrands(): Promise<ReadonlySet<string>> {
    try {
      return await this.knownBrandsProvider.listKnownBrands()
    } catch (error) {
      parseShoppingListLog.warn(LOG_EVENTS.CONVERSATION_KNOWN_BRANDS_UNAVAILABLE, { error: serializeError(error) })
      return new Set()
    }
  }
}
