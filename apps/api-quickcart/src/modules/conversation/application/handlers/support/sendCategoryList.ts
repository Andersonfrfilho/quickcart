/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A lista de categorias, num lugar só.
 *
 * Havia DUAS entradas para "ver produtos": o menu do motor de conversa, que montava e enviava a
 * lista, e a ação do grafo de fluxo, que apenas posicionava o estado e prometia a lista "na próxima
 * mensagem". Quem chegava pelo fluxo lia "só um instante" e o bot emudecia — nada mais era enviado
 * até a pessoa escrever de novo por conta própria.
 *
 * `conversation-flow.md` §5: todo caminho termina em fim explícito ou handoff; nó sem saída é
 * conversa que morre calada. Aqui a promessa e a entrega passam a ser a mesma coisa.
 */

import type { Category } from '@/infra/database/schema'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'

import { buildCategorySection } from './InteractiveListBuilders'

/** Portas estreitas: só o que esta função usa, para o teste não precisar de repositório inteiro. */
export type SendCategoryListParams = {
  readonly categoryRepository: { list(): Promise<Category[]> }
  readonly whatsAppSender: {
    sendText(phone: string, text: string): Promise<unknown>
    sendInteractiveList(
      phone: string,
      body: string,
      buttonLabel: string,
      sections: readonly { readonly rows: readonly unknown[] }[],
    ): Promise<unknown>
  }
  readonly customerPhone: string
}

/**
 * `false` quando não havia o que mostrar — e aí a pessoa recebeu o aviso, nunca silêncio. Quem
 * chama decide o que fazer com o estado da sessão nesse caso.
 */
export async function sendCategoryList(params: SendCategoryListParams): Promise<boolean> {
  const categories = await params.categoryRepository.list()

  if (categories.length === 0) {
    await params.whatsAppSender.sendText(params.customerPhone, MESSAGES.BROWSE_NO_CATEGORIES)
    return false
  }

  await params.whatsAppSender.sendInteractiveList(
    params.customerPhone,
    MESSAGES.BROWSE_PICK_CATEGORY,
    'Ver categorias',
    [buildCategorySection(categories)],
  )
  return true
}
