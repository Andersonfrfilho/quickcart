/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

export const RATE_LIMIT_KEY_PREFIX = 'rate-limit'
/** Chave usada quando o IP não chega em header nenhum (chamada direta, sem proxy). */
export const RATE_LIMIT_UNKNOWN_CLIENT = 'unknown'
export const RATE_LIMIT_EXCEEDED_MESSAGE = 'Muitas requisições; tente novamente em instantes'
export const RATE_LIMIT_STORE_FAILED_LOG_EVENT = 'rate_limit_store_failed'
