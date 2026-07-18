/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const SEARCH_MIN_QUERY_LENGTH = 2
export const SEARCH_DEFAULT_LIMIT = 8
export const SEARCH_MAX_LIMIT = 20

export const LIST_DEFAULT_PAGE = 1
export const LIST_DEFAULT_PER_PAGE = 20
export const LIST_MAX_PER_PAGE = 100

export const PRODUCT_UNITS = ['un', 'kg', 'g', 'l', 'ml', 'dz', 'pct'] as const
export const PRODUCT_SORTABLE_FIELDS = ['name', 'priceInCents', 'stockQuantity', 'createdAt'] as const
