/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Troco no dinheiro (roteiro §9, spec §3.1). A mesma regra de separador decimal do
 * `parseAttribute` do `customers-ui`: o ponto só é milhar quando há vírgula decimal
 * depois dele, ou quando é seguido de exatamente 3 dígitos ("1.500" é mil e quinhentos,
 * "150.5" é cento e cinquenta vírgula cinco).
 */

const CURRENCY_PREFIX_PATTERN = /^r\$\s*/i
const THOUSANDS_DOT_FOLLOWED_BY_THREE_DIGITS = /\.(?=\d{3}(\D|$))/g

/**
 * `undefined` para tudo que não é um valor positivo utilizável: vazio, texto, negativo ou zero.
 * Zero não é aceito porque "troco para zero" não é pedido de troco — é ausência de sentido.
 */
export function parseCashAmountToCents(text: string): number | undefined {
  return parseBareAmountToCents(text) ?? parseAmountInsidePhraseToCents(text)
}

/*
 * "troco pra 100", "vou pagar com 50": o cliente escreve a frase, não só o número. Só vale quando há
 * UM número na frase — "2 notas de 50" é ambíguo e cai na pergunta de novo. Sinal de menos recusa.
 */
const AMOUNT_TOKEN_PATTERN = /-?(?:r\$\s*)?\d(?:[\d.,]*\d)?/gi

function parseAmountInsidePhraseToCents(text: string): number | undefined {
  const tokens = text.match(AMOUNT_TOKEN_PATTERN) ?? []
  if (tokens.length !== 1) return undefined
  const [token] = tokens
  if (!token || token.startsWith('-')) return undefined
  return parseBareAmountToCents(token)
}

function parseBareAmountToCents(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined

  const withoutCurrency = trimmed.replace(CURRENCY_PREFIX_PATTERN, '')
  const hasDecimalComma = withoutCurrency.includes(',')

  const normalized = hasDecimalComma
    ? withoutCurrency.replace(/\./g, '').replace(',', '.')
    : withoutCurrency.replace(THOUSANDS_DOT_FOLLOWED_BY_THREE_DIGITS, '')

  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined

  const amount = Number.parseFloat(normalized)
  if (!Number.isFinite(amount) || amount <= 0) return undefined

  return Math.round(amount * 100)
}
