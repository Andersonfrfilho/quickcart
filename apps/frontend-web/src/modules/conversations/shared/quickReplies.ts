/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mensagens prontas do atendimento. A copy é do produto, não do pacote: o SDK sabe desenhar o chip e
 * interpolar `{{variavel}}`, mas o que se diz ao cliente é decisão de quem opera a loja.
 *
 * `{{nome}}` some quando o contato não tem nome salvo — daí "Olá!" em vez de "Olá {{nome}}!".
 */

import type { QuickReply } from '@adatechnology/conversations-ui'

export const CONVERSATION_QUICK_REPLIES: readonly QuickReply[] = [
  { key: 'greeting', label: '👋 Saudação', text: 'Olá {{nome}}! Como posso ajudar?' },
  {
    key: 'order',
    label: '🛒 Pedido',
    text: 'Já estou separando seu pedido {{pedido}}. Assim que fechar eu te confirmo por aqui!',
  },
  { key: 'delivery', label: '🚚 Entrega', text: 'A entrega sai hoje. Confirma o endereço para mim?' },
  { key: 'payment', label: '💳 Pagamento', text: 'Aceitamos Pix, cartão e dinheiro na entrega. Qual prefere?' },
  { key: 'missing', label: '📦 Em falta', text: 'Esse item está em falta hoje. Quer que eu sugira um parecido?' },
  { key: 'thanks', label: '🙏 Agradecimento', text: 'Obrigado pela preferência, {{nome}}! Qualquer coisa é só chamar.' },
]

/** Só o primeiro nome: "Olá Marina Alves!" soa como cobrança, "Olá Marina!" soa como atendimento. */
export function quickReplyVariablesFor(clientName?: string | null, orderCode?: string): Record<string, string> {
  return {
    nome: clientName?.trim().split(' ')[0] ?? '',
    pedido: orderCode ?? '',
  }
}
