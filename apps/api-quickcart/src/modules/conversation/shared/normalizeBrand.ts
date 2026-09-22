/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Normalização única de marca — minúsculas, sem acento, sem pontuação de borda —
 * usada nos dois lados da comparação: quem lê o catálogo (CachedKnownBrandsProvider)
 * e quem lê o segmento do cliente (ParseShoppingListUseCase). Uma diferença sutil
 * entre as duas faria "Broto Legal" do banco nunca bater com "broto legal." da
 * transcrição.
 */

const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g
const TRAILING_PUNCTUATION = /[.,;:!?]+$/

export function normalizeBrand(rawValue: string): string {
  return rawValue
    .normalize('NFD')
    .replace(COMBINING_DIACRITICAL_MARKS, '')
    .toLowerCase()
    .trim()
    .replace(TRAILING_PUNCTUATION, '')
    .trim()
}
