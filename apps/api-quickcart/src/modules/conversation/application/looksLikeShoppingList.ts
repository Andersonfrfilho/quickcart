/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Reconhece "isto é uma lista de compras" sem gastar chamada de IA.
 *
 * Serve de porteiro para a interpretação de lista, que custa uma chamada ao modelo: perguntar ao
 * modelo se cada mensagem é uma lista sairia caro e lento para descobrir que "oi" não é. O que decide
 * é a forma — quantidade, unidade de medida, itens separados — porque forma de lista é reconhecível
 * sem entender o conteúdo.
 *
 * É deliberadamente um teste de FORMA, não de assunto: não sabe o que é arroz, e não deve saber. Um
 * catálogo aqui dentro faria o porteiro reprovar o que o catálogo não tem, que é justamente o item
 * que o lojista precisa descobrir que falta.
 */

/** Unidades que aparecem em compra de supermercado. Abreviação junto, porque é como se dita. */
const UNIT_WORDS = [
  'kg',
  'quilo',
  'quilos',
  'g',
  'grama',
  'gramas',
  'l',
  'litro',
  'litros',
  'ml',
  'pacote',
  'pacotes',
  'caixa',
  'caixas',
  'duzia',
  'duzias',
  'unidade',
  'unidades',
  'garrafa',
  'garrafas',
  'lata',
  'latas',
  'saco',
  'sacos',
  'pote',
  'potes',
  'bandeja',
  'bandejas',
  'fardo',
  'fardos',
  'dente',
  'dentes',
  'maco',
  'macos',
] as const

/**
 * Números ditados. Quem manda áudio raramente diz "2" — a transcrição devolve "dois".
 *
 * Vai até doze porque acima disso a pessoa volta a usar algarismo, e "cem" em compra de supermercado
 * é mais provável em "cem gramas" (que já casa por unidade) que em contagem de item.
 */
const SPELLED_NUMBERS = [
  'um',
  'uma',
  'dois',
  'duas',
  'tres',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'meio',
  'meia',
  'metade',
] as const

/** Mínimo de itens para "várias coisas" contar como lista por si só. */
const ITEMS_FOR_LIST_BY_COUNT = 3

/** Abaixo disto não há forma para ler: "oi", "sim", "ok". */
const MIN_SIGNIFICANT_LENGTH = 6

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function hasWord(text: string, words: readonly string[]): boolean {
  // Fronteira de palavra importa: sem ela, "l" casaria dentro de "leite" e "g" dentro de "agua".
  return words.some((word) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text))
}

function countItems(text: string): number {
  return text
    .split(/,|;|\n|\+|\be\b/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length
}

export function looksLikeShoppingList(rawText: string): boolean {
  const text = normalize(rawText)
  if (text.length < MIN_SIGNIFICANT_LENGTH) return false

  const hasDigit = /\d/.test(text)
  const hasUnit = hasWord(text, UNIT_WORDS)
  const hasSpelledNumber = hasWord(text, SPELLED_NUMBERS)
  const itemCount = countItems(text)

  // Unidade de medida é o sinal mais forte que existe: ninguém diz "dois quilos" fora de compra.
  if (hasUnit && (hasDigit || hasSpelledNumber)) return true

  // Quantidade + vários itens: "2 arroz, 1 leite, 6 ovos" não tem unidade e é lista sem dúvida.
  if ((hasDigit || hasSpelledNumber) && itemCount >= 2) return true

  // Enumeração longa sem número nenhum: "arroz, feijão, macarrão, café".
  return itemCount >= ITEMS_FOR_LIST_BY_COUNT
}
