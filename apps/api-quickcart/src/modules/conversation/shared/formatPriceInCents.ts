/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export function formatPriceInCents(priceInCents: number): string {
  return (priceInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
