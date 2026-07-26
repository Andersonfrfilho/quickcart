/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Grafo inicial do fluxo principal. Reproduz exatamente o que GreetingHandler e MenuHandler
 * faziam em código, para que ligar o motor não mude o que o cliente vê no primeiro contato.
 *
 * Semente, não fonte da verdade: depois de criado, o grafo vive no banco e o lojista o edita
 * pelo editor visual. Este arquivo só existe para a instalação nascer com algo funcionando —
 * ele nunca sobrescreve um grafo já gravado.
 */

import type { FlowGraphData } from '@adatechnology/meta-whatsapp-contracts'
import { MENU_BUTTON_ID, MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import { QUICKCART_FLOW_ACTION } from '@/modules/conversation/application/registerQuickCartFlowActions'

export const MAIN_FLOW_START_NODE_ID = 'menu'

// `version: 0` porque a gravação otimista incrementa a partir do que está no banco; o valor
// aqui só vale no momento da criação.
export const MAIN_FLOW_SEED: Omit<FlowGraphData, 'version'> = {
  key: 'main',
  label: 'Atendimento principal',
  startNodeId: MAIN_FLOW_START_NODE_ID,
  nodes: {
    // Pergunta de escolha: o módulo envia os botões e espera a resposta. Os ids das opções são
    // os mesmos MENU_BUTTON_ID de antes — conversas em andamento e testes continuam válidos.
    menu: {
      id: 'menu',
      type: 'question',
      questionType: 'choice',
      question: MESSAGES.WELCOME,
      options: [
        [MENU_BUTTON_ID.SEND_LIST, '📝 Enviar lista'],
        [MENU_BUTTON_ID.BROWSE, '🛒 Ver produtos'],
        [MENU_BUTTON_ID.REPEAT_ORDER, '🔁 Repetir pedido'],
      ],
      fallbackMessage: MESSAGES.MENU_HINT,
      contextKey: 'menuChoice',
      position: { x: 0, y: 0 },
      next: {
        byAnswer: {
          [MENU_BUTTON_ID.SEND_LIST]: 'acao_lista',
          [MENU_BUTTON_ID.BROWSE]: 'acao_catalogo',
          [MENU_BUTTON_ID.REPEAT_ORDER]: 'acao_repetir',
        },
        // Resposta fora das opções volta ao próprio menu, que reenvia os botões — mesmo
        // comportamento do MenuHandler ao receber texto solto.
        default: 'menu',
      },
    },
    acao_lista: {
      id: 'acao_lista',
      type: 'action',
      actionKind: QUICKCART_FLOW_ACTION.START_LIST,
      position: { x: -240, y: 200 },
    },
    acao_catalogo: {
      id: 'acao_catalogo',
      type: 'action',
      actionKind: QUICKCART_FLOW_ACTION.BROWSE_CATALOG,
      position: { x: 0, y: 200 },
    },
    acao_repetir: {
      id: 'acao_repetir',
      type: 'action',
      actionKind: QUICKCART_FLOW_ACTION.REPEAT_ORDER,
      position: { x: 240, y: 200 },
    },
  },
}
