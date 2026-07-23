/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * 9 produtos + 1 linha "next_page" = 10 rows — limite máximo de uma seção de
 * lista interativa na WhatsApp Business API (spec §4 fala em "10/página", mas
 * a página cheia precisa reservar uma row para a navegação).
 */

export const BROWSE_PRODUCTS_PER_PAGE = 9
