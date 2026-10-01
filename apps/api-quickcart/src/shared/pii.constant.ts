/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

/** CEP em log: só a região (3 primeiros dígitos) — o bastante para diagnosticar sem identificar a rua. */
export const CEP_VISIBLE_DIGITS = 3
export const CEP_DIGITS = 8
export const CEP_MASK_CHARACTER = '*'

export const REDACTED_EMAIL = '[REDACTED_EMAIL]'
export const REDACTED_PHONE = '[REDACTED_PHONE]'
export const REDACTED_CEP = '[REDACTED_CEP]'

export const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
/** 10 a 13 dígitos seguidos (com ou sem +DDI): telefone BR com ou sem DDD/DDI. */
export const PHONE_PATTERN = /\+?(?<!\d)\d{10,13}(?!\d)/g
export const CEP_PATTERN = /(?<!\d)\d{5}-?\d{3}(?!\d)/g
