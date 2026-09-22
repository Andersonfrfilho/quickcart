/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

/** Rótulos do recibo simples (não fiscal). A taxa aparece só na entrega; "grátis" quando é 0. */
export const SIMPLE_RECEIPT_LABEL = {
  SUBTOTAL: 'Subtotal',
  DELIVERY_FEE: 'Taxa de entrega',
  FREE_DELIVERY: 'grátis',
  TOTAL: 'Total',
} as const
