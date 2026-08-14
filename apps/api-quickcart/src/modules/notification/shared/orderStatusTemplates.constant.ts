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
  [ORDER_STATUS.IN_TRANSIT]: '🛵 Pedido {{shortCode}} está a caminho do seu endereço.',
  [ORDER_STATUS.ARRIVED_AT_CUSTOMER]: '🔔 Chegamos! O pedido {{shortCode}} está na sua porta.',
  [ORDER_STATUS.READY_FOR_PICKUP]: '📦 Pedido {{shortCode}} está pronto para retirada.',
  /**
   * Neutro de propósito: o motivo interno (extraviado, endereço errado, recusado) fica na loja.
   *
   * Cliente lendo "extraviado" no WhatsApp não ganha nada e perde a confiança antes de alguém poder
   * explicar. O que ele precisa saber é que a entrega não aconteceu e que já estão falando com ele.
   */
  [ORDER_STATUS.DELIVERY_FAILED]: '⚠️ Não conseguimos concluir a entrega do pedido {{shortCode}}. Já vamos falar com você para resolver.',
  [ORDER_STATUS.COMPLETED]: '🎉 Pedido {{shortCode}} concluído. Obrigado pela preferência!',
  [ORDER_STATUS.CANCELLED]: '❌ Pedido {{shortCode}} foi cancelado.',
}

export const ORDER_NOTIFICATION_CATEGORY = 'order_status'

export function orderStatusTemplateKey(status: string): string {
  return `order.status.${status}`
}

/**
 * Nome do template APROVADO na Meta, por status.
 *
 * O módulo recusa texto livre no WhatsApp quando não há `whatsappTemplateName` — e está certo: fora
 * da janela de 24h a Graph API só aceita template aprovado, e quem sabe se a janela está aberta é
 * ela, não o pacote. Sem isto, a delivery nasce `skipped` com `whatsapp_template_required`, que foi
 * exatamente o que o E2E revelou.
 *
 * Vale registrar o que isso diz sobre o código antigo: o `ProcessNotificationJob` mandava `sendText`
 * livre, então **só funcionava dentro da janela** — fora dela a Meta rejeitava, e o pedido seguia
 * como se o cliente tivesse sido avisado. O SDK falha visível em vez de falhar calado.
 *
 * ⚠️ Estes nomes precisam existir e estar APROVADOS no WhatsApp Manager da conta. Aprovação é
 * processo externo, com fila de revisão da Meta — cadastrar status novo aqui não basta.
 */
const META_TEMPLATE_BY_STATUS: Record<string, string> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: 'quickcart_pedido_recebido',
  [ORDER_STATUS.CONFIRMED]: 'quickcart_pedido_confirmado',
  [ORDER_STATUS.PREPARING]: 'quickcart_pedido_em_separacao',
  [ORDER_STATUS.SEPARATED]: 'quickcart_pedido_separado',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'quickcart_pedido_em_entrega',
  [ORDER_STATUS.IN_TRANSIT]: 'quickcart_pedido_a_caminho',
  [ORDER_STATUS.ARRIVED_AT_CUSTOMER]: 'quickcart_pedido_na_porta',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'quickcart_pedido_pronto_retirada',
  [ORDER_STATUS.DELIVERY_FAILED]: 'quickcart_pedido_entrega_nao_concluida',
  [ORDER_STATUS.COMPLETED]: 'quickcart_pedido_concluido',
  [ORDER_STATUS.CANCELLED]: 'quickcart_pedido_cancelado',
}

export type OrderStatusTemplate = {
  readonly key: string
  readonly channel: string
  readonly locale: string
  readonly subject: string
  readonly body: string
  readonly active: boolean
  readonly whatsappTemplateName?: string
}

/**
 * Título curto por status, separado do corpo.
 *
 * Sem `subject`, o renderer do módulo deriva o título DO corpo — e a inbox mostrava a mesma frase
 * duas vezes em cada linha, título e texto idênticos. Só apareceu abrindo a tela.
 *
 * O título é o que se lê na varredura: diz o estado, e o corpo completa. No WhatsApp o `subject` é
 * ignorado, então o corpo continua se explicando sozinho.
 */
const ORDER_STATUS_SUBJECT: Record<string, string> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: 'Pedido {{shortCode}} recebido',
  [ORDER_STATUS.CONFIRMED]: 'Pedido {{shortCode}} confirmado',
  [ORDER_STATUS.PREPARING]: 'Pedido {{shortCode}} em separação',
  [ORDER_STATUS.SEPARATED]: 'Pedido {{shortCode}} separado',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Pedido {{shortCode}} saiu para entrega',
  [ORDER_STATUS.IN_TRANSIT]: 'Pedido {{shortCode}} a caminho',
  [ORDER_STATUS.ARRIVED_AT_CUSTOMER]: 'Pedido {{shortCode}} na sua porta',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'Pedido {{shortCode}} pronto para retirada',
  [ORDER_STATUS.DELIVERY_FAILED]: 'Entrega do pedido {{shortCode}} não concluída',
  [ORDER_STATUS.COMPLETED]: 'Pedido {{shortCode}} concluído',
  [ORDER_STATUS.CANCELLED]: 'Pedido {{shortCode}} cancelado',
}

/**
 * Emoji aqui é deliberado e não contraria a regra de ícones em UI: isto é corpo de mensagem de
 * WhatsApp e de inbox, texto puro, onde não existe biblioteca de ícones nem `currentColor` a herdar.
 */
export function buildOrderStatusTemplates(): readonly OrderStatusTemplate[] {
  return Object.entries(ORDER_STATUS_BODY).flatMap(([status, body]) => {
    const base = {
      key: orderStatusTemplateKey(status),
      locale: 'pt-BR',
      subject: ORDER_STATUS_SUBJECT[status] ?? 'Atualização do pedido {{shortCode}}',
      body,
      active: true,
    }
    const metaTemplateName = META_TEMPLATE_BY_STATUS[status]

    return [
      // Inbox sempre: é o canal que funciona quando o número está fora da janela da Meta, e o que
      // deixa o aviso no histórico do cliente.
      { ...base, channel: 'inbox' },
      ...(metaTemplateName ? [{ ...base, channel: 'whatsapp', whatsappTemplateName: metaTemplateName }] : []),
    ]
  })
}
