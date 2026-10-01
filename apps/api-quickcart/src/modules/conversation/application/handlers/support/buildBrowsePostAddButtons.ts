/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Os 3 botões enviados depois de adicionar um produto durante a navegação — "mais desta
 * categoria" / "outra categoria" / "ver carrinho" — no lugar de reenviar a lista de produtos
 * sozinha, que escondia a saída (relato do cliente que ficou preso em "Não encontrei 'Não'").
 * Sem parâmetro: ao contrário dos botões de decisão de pedido, nenhum id de negócio precisa
 * viajar dentro do botão — o contexto de categoria/página já vive na sessão.
 */

import type { InteractiveButton } from '@adatechnology/meta-whatsapp-provider'
import { BROWSE_POST_ADD_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'

export function buildBrowsePostAddButtons(): readonly InteractiveButton[] {
  return [
    { id: BROWSE_POST_ADD_BUTTON_ID.MORE_CATEGORY, title: MESSAGES.BROWSE_POST_ADD_MORE_CATEGORY },
    { id: BROWSE_POST_ADD_BUTTON_ID.OTHER_CATEGORY, title: MESSAGES.BROWSE_POST_ADD_OTHER_CATEGORY },
    { id: BROWSE_POST_ADD_BUTTON_ID.VIEW_CART, title: MESSAGES.BROWSE_POST_ADD_VIEW_CART },
  ]
}
