/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Reconhece frase de encerramento digitada durante a navegação (`browsing_categories`) — "Não",
 * "pronto", "só isso" etc. — e leva ao carrinho pelo MESMO caminho do gatilho "carrinho" de sempre.
 *
 * Casamento é por FRASE INTEIRA depois de normalizar (minúsculas, sem acento, sem pontuação), nunca
 * substring: "não tem arroz integral?" continua sendo busca de produto, não encerramento.
 *
 * Não precisa rodar antes do interpretador de lista de compras (`looksLikeShoppingList`) no
 * `GlobalHandler`: toda frase de `BROWSE_CART_DONE_WORDS` é curta demais ou sem forma de lista
 * (sem dígito, unidade ou 2+ itens separados) para o porteiro confundir com lista — verificado frase
 * a frase ao escrever esta função. `BrowseHandler` é quem checa isto, antes de tratar o texto como
 * busca de produto.
 */

import { BROWSE_CART_DONE_WORDS } from '@/modules/conversation/shared/Messages.constant'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isCartDoneRequest(rawText: string): boolean {
  const normalized = normalize(rawText)
  if (!normalized) return false

  return (BROWSE_CART_DONE_WORDS as readonly string[]).includes(normalized)
}
