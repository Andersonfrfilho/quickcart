/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Fala social que a transcrição de áudio entrega junto da lista. O descarte compara o termo
 * INTEIRO, nunca pedaço dele: "bom dia" é saudação, mas "café bom dia" é marca de café e tem
 * de chegar intacto no trigram. Por isso aqui só entra expressão que nunca é produto sozinha —
 * nada de palavra genérica removível do meio do termo.
 */

export const LIST_NOISE_TERMS: ReadonlySet<string> = new Set([
  // Saudação
  'bom dia',
  'boa tarde',
  'boa noite',
  'oi',
  'ola',
  'opa',
  'alo',
  'e ai',
  'eai',
  'tudo bem',
  'tudo bom',
  // Despedida e agradecimento
  'obrigado',
  'obrigada',
  'valeu',
  'tchau',
  'ate logo',
  'falou',
  // Fecho de lista
  'e so',
  'so isso',
  'e so isso',
  'e isso',
  'isso',
  'mais nada',
  'so',
  'acabou',
  'pronto',
  'por enquanto',
  // Cortesia e muleta de fala
  'por favor',
  'pfv',
  'entao',
  'ta',
  'ne',
  'hum',
  'ahn',
  'pera',
  'pera ai',
  'deixa eu ver',
])
