/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * 8 produtos + "anterior" + "próxima" = 10 rows — limite máximo de uma seção de
 * lista interativa na WhatsApp Business API (spec §4 fala em "10/página", mas
 * a página cheia precisa reservar uma row para cada linha de navegação). As
 * duas linhas de navegação são reservadas em toda página, mesmo quando só uma
 * (ou nenhuma) aparece — assim o offset de cada página vem da mesma conta, e
 * ir e voltar sempre mostra os mesmos produtos.
 */

export const BROWSE_PRODUCTS_PER_PAGE = 8
