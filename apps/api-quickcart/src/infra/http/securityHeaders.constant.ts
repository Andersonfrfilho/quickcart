/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Headers de segurança de toda resposta da API (security.md §3).
 */

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
} as const

export const STRICT_TRANSPORT_SECURITY_HEADER = 'Strict-Transport-Security'
export const STRICT_TRANSPORT_SECURITY_VALUE = 'max-age=31536000; includeSubDomains'
export const HTTPS_FORWARDED_PROTO = 'https'
