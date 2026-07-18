/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export type SeedCategory = {
  readonly key: string
  readonly name: string
  readonly emoji: string
  readonly sortOrder: number
}

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  { key: 'mercearia', name: 'Mercearia', emoji: '🛒', sortOrder: 1 },
  { key: 'hortifruti', name: 'Hortifruti', emoji: '🥬', sortOrder: 2 },
  { key: 'acougue', name: 'Açougue', emoji: '🥩', sortOrder: 3 },
  { key: 'padaria', name: 'Padaria', emoji: '🍞', sortOrder: 4 },
  { key: 'laticinios', name: 'Laticínios', emoji: '🧀', sortOrder: 5 },
  { key: 'bebidas', name: 'Bebidas', emoji: '🥤', sortOrder: 6 },
  { key: 'limpeza', name: 'Limpeza', emoji: '🧼', sortOrder: 7 },
  { key: 'higiene', name: 'Higiene Pessoal', emoji: '🧴', sortOrder: 8 },
  { key: 'congelados', name: 'Congelados', emoji: '🧊', sortOrder: 9 },
  { key: 'pet', name: 'Pet', emoji: '🐾', sortOrder: 10 },
]
