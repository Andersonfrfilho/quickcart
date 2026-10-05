/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O que o cliente digita e o que a busca tem de devolver — a medida que substitui "olhei e parece bom".
 *
 * Existe porque cada correção da busca nasceu de um termo que falhou, e consertar por anedota não diz
 * se a correção quebrou outro termo. Duas listas, e a segunda vale tanto quanto a primeira:
 *
 *  - `MUST_MATCH`: o termo tem de achar o produto. É o que prova que a regra funciona.
 *  - `MUST_NOT_MATCH`: o termo é ruído e tem de dar `not_found`. É o que barra a regra que acerta
 *    tudo porque aceita tudo — foi assim que `word_similarity` mostrou o defeito: "paes" achava
 *    *Escova de Dentes* a 0,60 e "pe" achava *Abacaxi* a 0,67.
 *
 * `origin` diz de onde veio o termo. Termo real (`unmatched_demands`) pesa mais que termo derivado: o
 * derivado prova a regra, o real prova que a regra importa.
 *
 * Os nomes esperados são os do catálogo semeado (`make seed ENV=test`), não os de produção: o corpus
 * mede o algoritmo, e o catálogo de produção muda sem passar por revisão de código.
 */

export const CORPUS_ORIGIN = {
  /** Registrado em `unmatched_demands` de um ambiente real. */
  REAL_DEMAND: 'real',
  /** Montado a partir de uma regra do idioma, para provar a família inteira. */
  DERIVED: 'derived',
  /** Já funcionava antes: está aqui para que a próxima mudança não o quebre. */
  GUARD: 'guard',
} as const

export type CorpusOrigin = (typeof CORPUS_ORIGIN)[keyof typeof CORPUS_ORIGIN]

export type MustMatchEntry = {
  readonly term: string
  /** Prefixo do nome do produto que tem de estar no topo. */
  readonly expectedTopName: string
  readonly family: string
  readonly origin: CorpusOrigin
}

export type MustNotMatchEntry = {
  readonly term: string
  readonly reason: string
  readonly origin: CorpusOrigin
}

export const MUST_MATCH: readonly MustMatchEntry[] = [
  // plural em -ão: o radical muda, o trigrama não alcança. "paes" falhou 5× em staging no mesmo dia.
  { term: 'paes', expectedTopName: 'Pão Francês', family: 'plural -ão', origin: CORPUS_ORIGIN.REAL_DEMAND },
  { term: 'pães', expectedTopName: 'Pão Francês', family: 'plural -ão', origin: CORPUS_ORIGIN.DERIVED },
  { term: 'paes franceses', expectedTopName: 'Pão Francês', family: 'plural -ão', origin: CORPUS_ORIGIN.DERIVED },
  { term: 'feijoes', expectedTopName: 'Feijão Carioca', family: 'plural -ão', origin: CORPUS_ORIGIN.DERIVED },
  { term: 'limoes', expectedTopName: 'Limão Tahiti', family: 'plural -ão', origin: CORPUS_ORIGIN.DERIVED },
  { term: 'macarroes', expectedTopName: 'Macarrão Espaguete', family: 'plural -ão', origin: CORPUS_ORIGIN.DERIVED },
  // "sabões" casava *Sabonete* no topo, a 0,33 — o produto errado, e sem aviso.
  { term: 'sabões', expectedTopName: 'Sabão', family: 'plural -ão', origin: CORPUS_ORIGIN.DERIVED },
  { term: 'saboes', expectedTopName: 'Sabão', family: 'plural -ão', origin: CORPUS_ORIGIN.DERIVED },

  // plural em -el/-al: o produto existia e ficava a 0,25, abaixo do mínimo de 0,3.
  { term: 'papeis', expectedTopName: 'Papel Higiênico', family: 'plural -el', origin: CORPUS_ORIGIN.DERIVED },
  { term: 'papéis', expectedTopName: 'Papel Higiênico', family: 'plural -el', origin: CORPUS_ORIGIN.DERIVED },
  { term: 'papeis higienicos', expectedTopName: 'Papel Higiênico', family: 'plural -el', origin: CORPUS_ORIGIN.DERIVED },

  // o que já funcionava — a regra nova não pode tirar daqui
  { term: 'pao', expectedTopName: 'Pão Francês', family: 'singular', origin: CORPUS_ORIGIN.GUARD },
  { term: 'tomates', expectedTopName: 'Tomate', family: 'plural regular', origin: CORPUS_ORIGIN.GUARD },
  { term: 'refrigerantes', expectedTopName: 'Refrigerante', family: 'plural regular', origin: CORPUS_ORIGIN.GUARD },
  { term: 'cafe', expectedTopName: 'Café', family: 'acento', origin: CORPUS_ORIGIN.GUARD },
  { term: 'guarana', expectedTopName: 'Refrigerante Guaraná', family: 'alias', origin: CORPUS_ORIGIN.GUARD },
]

export const MUST_NOT_MATCH: readonly MustNotMatchEntry[] = [
  // ruído que cliente real mandou — está em `unmatched_demands` de staging
  { term: 'tixa', reason: 'digitação sem sentido', origin: CORPUS_ORIGIN.REAL_DEMAND },
  { term: 'pe', reason: 'duas letras: casaria Abacaxi ou Peixe por acaso de trigrama', origin: CORPUS_ORIGIN.REAL_DEMAND },
  { term: 'quilos', reason: 'unidade solta, sem produto', origin: CORPUS_ORIGIN.REAL_DEMAND },
  { term: 'oi', reason: 'saudação', origin: CORPUS_ORIGIN.REAL_DEMAND },
  { term: 'bom dia', reason: 'saudação', origin: CORPUS_ORIGIN.REAL_DEMAND },
  { term: 'ola', reason: 'saudação', origin: CORPUS_ORIGIN.REAL_DEMAND },
  { term: 'xyzabc123nonexistent', reason: 'termo inexistente', origin: CORPUS_ORIGIN.GUARD },
]
