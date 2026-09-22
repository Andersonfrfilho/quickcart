/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ponto único para não perder a memória do checkout (T2.3) nas transições do ciclo de
 * montagem/edição do carrinho — Alterar, editar item, "adicionar mais", resolução de
 * pendências e volta a cart_review. Quem aperta "Alterar" quer mudar o CARRINHO, não abrir
 * mão da memória do checkout; essas transições gravavam `context: {}` e apagavam as duas
 * coisas juntas.
 *
 * Carrega só `rememberedCheckout`: as outras chaves de checkout (tipo de entrega, pagamento,
 * troco) continuam de fora até o cliente aceitar de novo a pergunta de "repetir última compra" —
 * é ela quem decide o que vale, não este helper.
 */

import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'

export function carryRememberedCheckout(context: ConversationContext): Pick<ConversationContext, 'rememberedCheckout'> {
  return context.rememberedCheckout ? { rememberedCheckout: context.rememberedCheckout } : {}
}
