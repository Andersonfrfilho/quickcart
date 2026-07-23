/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const CART_STATUS = {
  OPEN: 'open',
  ORDERED: 'ordered',
  ABANDONED: 'abandoned',
} as const

export type CartStatus = (typeof CART_STATUS)[keyof typeof CART_STATUS]

export const CART_ITEM_MATCH_TYPE = {
  AUTO: 'auto',
  SELECTED: 'selected',
  MANUAL: 'manual',
} as const

export type CartItemMatchType = (typeof CART_ITEM_MATCH_TYPE)[keyof typeof CART_ITEM_MATCH_TYPE]
