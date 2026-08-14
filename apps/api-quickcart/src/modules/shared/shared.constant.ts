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

/**
 * Tetos do WhatsApp para resposta rápida. São da Graph API, não uma preferência nossa.
 *
 * Estourar qualquer um dos dois não degrada a mensagem: a Meta **recusa a mensagem inteira**, e o cliente
 * vê silêncio. Como o envio costuma acontecer longe de quem escreveu o texto, a falha só aparece em
 * produção — por isso os limites são constante conferível por teste, e não número solto no call site.
 *
 * O emoji conta no orçamento do título, e custa 2 ou 3 dos 20 caracteres.
 */
export const WHATSAPP_BUTTON_TITLE_MAX_LENGTH = 20
export const WHATSAPP_MAX_BUTTONS = 3
