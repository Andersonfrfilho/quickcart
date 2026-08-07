/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O que o QuickCart notifica, e por onde. Vive no host porque é decisão de produto: o SDK sabe
 * despachar em quatro canais e não tem opinião sobre quais fazem sentido numa loja.
 */

export const NOTIFICATION_CHANNELS = [
  {
    id: 'inbox',
    label: 'Inbox',
    hint: 'Fica no histórico do cliente. É o único que funciona sempre — não depende de janela, token nem caixa de entrada.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Exige template aprovado na Meta. Fora da janela de 24h, texto livre é recusado pela Graph API.',
  },
  {
    id: 'email',
    label: 'E-mail',
    hint: 'Precisa de SMTP configurado. Em desenvolvimento cai no Mailpit e não sai da máquina.',
  },
  {
    id: 'push',
    label: 'Push',
    hint: 'Exige aparelho registrado. Sem token, o canal simplesmente não é planejado.',
  },
] as const

export type NotificationChannelId = (typeof NOTIFICATION_CHANNELS)[number]['id']

/**
 * As categorias que o produto dispara hoje. Uma só, e declarada como lista de propósito: quando
 * entrar "promoção" ou "carrinho abandonado", a tela já sabe desenhar sem mudar de forma.
 */
export const NOTIFICATION_CATEGORIES = [
  {
    id: 'order_status',
    label: 'Status do pedido',
    hint: 'Cada mudança na esteira do pedido — de recebido a concluído.',
  },
] as const

/**
 * Exemplo para o preview.
 *
 * Os nomes têm de bater com o `payload` que o `SdkOrderStatusNotifier` envia, senão o preview mostra
 * campo vazio e quem está escrevendo o texto conclui que errou a sintaxe.
 */
export const TEMPLATE_PREVIEW_PAYLOAD: Readonly<Record<string, unknown>> = {
  shortCode: 'QC-1042',
}

/**
 * Rótulo por status. Literais e não `ORDER_STATUS` do app da api: o frontend não importa código de
 * outra aplicação do monorepo (`code-standart.md` §2), e o contrato entre os dois é a string que a
 * api já devolve no `templateKey`.
 */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  preparing: 'Em separação',
  separated: 'Separado',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}
