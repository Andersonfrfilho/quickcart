/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cenários de conversa para exercitar paginação e filtros da inbox. O volume é deliberado: com
 * meia dúzia de conversas a paginação nunca vira segunda página e a faixa de janela nunca fica
 * vazia, então os dois defeitos mais prováveis passariam despercebidos.
 */

export const CONVERSATION_WINDOW_BAND = {
  FRESH: 'fresh',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EXPIRED: 'expired',
} as const
export type ConversationWindowBand = (typeof CONVERSATION_WINDOW_BAND)[keyof typeof CONVERSATION_WINDOW_BAND]

// Horas atrás do último inbound, escolhidas no meio de cada faixa para o teste não depender do
// instante exato em que o seed roda.
export const HOURS_AGO_BY_BAND: Readonly<Record<ConversationWindowBand, number>> = {
  [CONVERSATION_WINDOW_BAND.FRESH]: 4,
  [CONVERSATION_WINDOW_BAND.WARNING]: 16,
  [CONVERSATION_WINDOW_BAND.CRITICAL]: 22,
  [CONVERSATION_WINDOW_BAND.EXPIRED]: 72,
}

export type ConversationScenario = {
  readonly whatsappNumber: string
  readonly customerName?: string
  readonly band: ConversationWindowBand
  readonly mode: 'bot' | 'human'
  readonly waitingHuman: boolean
  readonly messages: readonly { readonly direction: 'inbound' | 'outbound'; readonly content: string }[]
}

const FIRST_NAMES = [
  'Marina', 'Diego', 'Sofia', 'Rafael', 'Beatriz', 'Caio', 'Helena', 'Otávio', 'Larissa', 'Tiago',
  'Camila', 'Bruno', 'Aline', 'Vitor', 'Priscila', 'Gustavo', 'Renata', 'Fábio', 'Juliana', 'Márcio',
]

const LAST_NAMES = [
  'Alves', 'Prado', 'Nakamura', 'Moreira', 'Fontes', 'Rocha', 'Barros', 'Siqueira', 'Teixeira', 'Braga',
]

const CUSTOMER_OPENERS = [
  'oi, boa tarde',
  'bom dia, tudo bem?',
  'preciso de ajuda com meu pedido',
  'quero fazer uma compra',
  'oi',
]

const CUSTOMER_LISTS = [
  '2kg de arroz, leite e 6 ovos',
  'feijão, macarrão e molho de tomate',
  '1 pacote de café e açúcar',
  'detergente, sabão em pó e esponja',
  'banana, maçã e mamão',
]

const BOT_REPLIES = [
  '👋 Olá! Me manda sua lista de compras que eu monto o carrinho.',
  'Encontrei mais de uma opção. Qual você prefere?',
  'Adicionei ao carrinho. Quer mais alguma coisa?',
]

const AGENT_REPLIES = [
  'Oi! Sou do atendimento, vou te ajudar a partir daqui.',
  'Já separei seu pedido, confere pra mim?',
  'Consegui a troca que você pediu.',
]

// Índice determinístico: o mesmo seed produz sempre a mesma base, o que torna um defeito visto uma
// vez reproduzível. Aleatoriedade aqui só atrapalharia.
function pick<TItem>(items: readonly TItem[], index: number): TItem {
  return items[index % items.length] as TItem
}

const BAND_DISTRIBUTION: readonly ConversationWindowBand[] = [
  ...Array<ConversationWindowBand>(40).fill(CONVERSATION_WINDOW_BAND.FRESH),
  ...Array<ConversationWindowBand>(30).fill(CONVERSATION_WINDOW_BAND.WARNING),
  ...Array<ConversationWindowBand>(20).fill(CONVERSATION_WINDOW_BAND.CRITICAL),
  ...Array<ConversationWindowBand>(30).fill(CONVERSATION_WINDOW_BAND.EXPIRED),
]

/**
 * 120 conversas: três páginas de 50 com a última incompleta, que é onde erro de offset aparece.
 */
export function buildConversationScenarios(): ConversationScenario[] {
  return BAND_DISTRIBUTION.map((band, index) => {
    // Metade sem nome, para exercitar a linha que cai no telefone como título.
    const hasName = index % 2 === 0
    const isHuman = index % 8 === 0
    const isWaiting = !isHuman && index % 5 === 0

    const messages: ConversationScenario['messages'] = [
      { direction: 'inbound', content: pick(CUSTOMER_OPENERS, index) },
      { direction: 'outbound', content: pick(BOT_REPLIES, index) },
      { direction: 'inbound', content: pick(CUSTOMER_LISTS, index) },
      ...(isHuman ? [{ direction: 'outbound' as const, content: pick(AGENT_REPLIES, index) }] : []),
    ]

    return {
      // Faixa 55119xxxx0000 reservada ao seed: não colide com número real nem com o do preview.
      whatsappNumber: `5511${String(900000000 + index).padStart(9, '0')}`,
      ...(hasName ? { customerName: `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, index)}` } : {}),
      band,
      mode: isHuman ? ('human' as const) : ('bot' as const),
      waitingHuman: isWaiting,
      messages,
    }
  })
}
