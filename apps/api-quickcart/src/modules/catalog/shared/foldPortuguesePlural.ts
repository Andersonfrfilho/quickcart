/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Plural irregular do português de volta ao singular, para a busca.
 *
 * São os plurais em que o radical muda — "pães" não é "pão" + s, "papéis" não é "papel" + s — e por
 * isso o trigrama não os aproxima. Medido no catálogo: "paes" contra "Pão Francês" dá 0,29, a 0,01 do
 * mínimo de 0,3, enquanto "pao" dá 1,00 pelo alias. O cliente que pedia "pães" ouvia "não encontrei".
 *
 * Os plurais regulares (ovos, tomates, bananas) só acrescentam letra e o trigrama absorve sozinho:
 * `tomates` dá 0,67 e `refrigerantes` 0,80 sem regra nenhuma. Por isso a tabela abaixo só tem famílias
 * que o corpus mostrou falhando — acrescentar regra especulativa é acrescentar falso positivo.
 *
 * Roda sobre texto sem acento, porque a busca compara com `immutable_unaccent` dos dois lados e o
 * cliente digita "paes" tanto quanto "pães". O resultado é uma VARIANTE a mais da busca, nunca um
 * substituto do termo: a original continua concorrendo, então uma dobra indevida só acrescenta
 * candidato, não tira o que já casava.
 */

type PluralFoldRule = {
  readonly pluralSuffix: string
  readonly singularSuffix: string
  /**
   * Palavra curta e comum que termina igual não é plural: com 4 letras "caos" viraria "cao", "seis"
   * viraria "sel" e "mais" viraria "mal" — e "seis ovos" é pedido que existe.
   */
  readonly minTokenLength: number
}

const PLURAL_FOLD_RULES: readonly PluralFoldRule[] = [
  // -ão: pães, feijões, limões, sabões, grãos
  { pluralSuffix: 'aes', singularSuffix: 'ao', minTokenLength: 4 },
  { pluralSuffix: 'oes', singularSuffix: 'ao', minTokenLength: 4 },
  { pluralSuffix: 'aos', singularSuffix: 'ao', minTokenLength: 5 },
  // -el / -al: papéis, pastéis, cereais, jornais
  { pluralSuffix: 'eis', singularSuffix: 'el', minTokenLength: 6 },
  { pluralSuffix: 'ais', singularSuffix: 'al', minTokenLength: 6 },
]

function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function foldToken(token: string): string {
  const rule = PLURAL_FOLD_RULES.find(
    (candidate) => token.length >= candidate.minTokenLength && token.endsWith(candidate.pluralSuffix),
  )
  if (!rule) return token

  return `${token.slice(0, -rule.pluralSuffix.length)}${rule.singularSuffix}`
}

/** `undefined` quando nenhuma palavra do termo era plural irregular: não há variante a buscar. */
export function foldPortuguesePlural(term: string): string | undefined {
  const tokens = removeDiacritics(term.toLowerCase()).split(/\s+/)
  const foldedTokens = tokens.map(foldToken)

  const hasFoldedToken = foldedTokens.some((foldedToken, index) => foldedToken !== tokens[index])
  if (!hasFoldedToken) return undefined

  return foldedTokens.join(' ').trim()
}
