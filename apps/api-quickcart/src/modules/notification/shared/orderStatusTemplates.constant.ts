/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O texto que o cliente lê a cada mudança de status.
 *
 * Vem do host e não do pacote: copy é regra de negócio, e o `notification-module` não inventa
 * conteúdo. Aqui é só o default de boot — a partir do primeiro `upsert` pela rota de templates, o
 * lojista muda o texto sem deploy, e a versão anterior fica legível para auditoria.
 *
 * Portado de `worker-quickcart/modules/notification/shared/NotificationMessages.constant.ts`, que
 * montava a string em código. A diferença que importa: ali `status` desconhecido caía num
 * fallback silencioso com log de aviso; aqui um status sem template faz o envio falhar de forma
 * visível, o que é melhor — "O pedido X teve uma atualização" é a mensagem que ninguém escreveu e
 * todo cliente recebe quando alguém acrescenta um status e esquece o texto.
 */

import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'

/** `{{shortCode}}` é interpolado pelo renderer do módulo a partir do `payload` do envio. */
const ORDER_STATUS_BODY: Record<string, string> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: '⏳ Pedido {{shortCode}} recebido e aguardando confirmação.',
  [ORDER_STATUS.CONFIRMED]: '✅ Pedido {{shortCode}} confirmado! Já vamos começar a separar.',
  [ORDER_STATUS.PREPARING]: '🛒 Pedido {{shortCode}} está sendo preparado.',
  [ORDER_STATUS.SEPARATED]: '✅ Pedido {{shortCode}} está separado e pronto.',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: '🚚 Pedido {{shortCode}} saiu para entrega!',
  [ORDER_STATUS.READY_FOR_PICKUP]: '📦 Pedido {{shortCode}} está pronto para retirada.',
  [ORDER_STATUS.COMPLETED]: '🎉 Pedido {{shortCode}} concluído. Obrigado pela preferência!',
  [ORDER_STATUS.CANCELLED]: '❌ Pedido {{shortCode}} foi cancelado.',
}

export const ORDER_NOTIFICATION_CATEGORY = 'order_status'

export function orderStatusTemplateKey(status: string): string {
  return `order.status.${status}`
}

/**
 * Emoji aqui é deliberado e não contraria a regra de ícones em UI: isto é corpo de mensagem de
 * WhatsApp, texto puro, onde não existe biblioteca de ícones nem `currentColor` a herdar.
 */
export function buildOrderStatusTemplates(): readonly {
  readonly key: string
  readonly channel: string
  readonly locale: string
  readonly body: string
  readonly active: boolean
}[] {
  return Object.entries(ORDER_STATUS_BODY).flatMap(([status, body]) =>
    // Inbox além do WhatsApp: o mesmo aviso fica no histórico do cliente, e é o canal que funciona
    // quando o número está fora da janela de 24h da Meta.
    (['whatsapp', 'inbox'] as const).map((channel) => ({
      key: orderStatusTemplateKey(status),
      channel,
      locale: 'pt-BR',
      body,
      active: true,
    })),
  )
}
