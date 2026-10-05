/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Minúscula, sem acento, sem pontuação e com espaço único — a forma em que as listas de palavras
 * deste módulo são escritas, para que "Cadê meu pedido?!" e "cade meu pedido" sejam a mesma coisa.
 *
 * Existe como arquivo próprio porque `isCancelOrderRequest`, `isHumanHandoffRequest` e os
 * reconhecedores do pós-compra tinham cada um a sua cópia: três normalizações divergentes decidindo
 * a mesma pergunta davam ao cliente respostas diferentes para a mesma frase.
 */

export function normalizeMessageText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
