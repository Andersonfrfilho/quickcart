/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Constantes compartilhadas entre módulos (regra 16 de code-standart.md).
 */

export const CHANNEL = {
  WHATSAPP: 'whatsapp',
  WEB: 'web',
} as const

export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL]
