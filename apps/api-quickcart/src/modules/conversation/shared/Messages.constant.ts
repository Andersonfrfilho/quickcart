/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Todo texto voltado ao cliente no motor de conversa vive aqui — nenhuma string de
 * UI deve ficar hardcoded dentro de um handler. Ids de botão/row são literais da
 * spec §4/§3.3 — handlers de outras fases (ex.: CartHandler na Fase 5) dependem
 * desses valores exatos para rotear button_reply/list_reply.
 */

export const MENU_BUTTON_ID = {
  SEND_LIST: 'send_list',
  BROWSE: 'browse',
  REPEAT_ORDER: 'repeat_order',
} as const

export const CART_REVIEW_BUTTON_ID = {
  CHECKOUT: 'checkout',
  ADD_MORE: 'add_more',
  EDIT_CART: 'edit_cart',
} as const

export const BROWSE_ROW_ID = {
  NEXT_PAGE: 'next_page',
} as const

export const BROWSE_ROW_PREFIX = {
  CATEGORY: 'category:',
  PRODUCT: 'product:',
} as const

export const RESOLVE_ROW_ID = {
  SKIP_ITEM: 'skip_item',
} as const

export const RESOLVE_ROW_PREFIX = {
  PRODUCT: 'product:',
} as const

export const EDITING_CART_ROW_ID = {
  DONE: 'done_editing',
} as const

export const EDITING_CART_ROW_PREFIX = {
  ITEM: 'item:',
} as const

export const DELIVERY_TYPE_BUTTON_ID = {
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
} as const

export const PAYMENT_METHOD_BUTTON_ID = {
  PIX: 'pix',
  CARD_ON_DELIVERY: 'card_on_delivery',
  CASH: 'cash',
} as const

export const RECEIPT_PREFERENCE_BUTTON_ID = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  BOTH: 'both',
} as const

export const CONFIRMING_BUTTON_ID = {
  CONFIRM: 'confirm_order',
  CANCEL: 'cancel_order',
} as const

export const BROWSE_TRIGGER = {
  VIEW_CART_WORDS: ['ver carrinho', 'carrinho'],
} as const

export const GLOBAL_TRIGGER = {
  EXIT_WORDS: ['sair', 'cancelar'],
} as const

export const MESSAGES = {
  WELCOME:
    '👋 Olá! Eu sou o assistente de compras do QuickCart. Me manda sua lista (texto ou áudio) que eu já monto seu carrinho, ou escolha uma opção abaixo:',
  MENU_HINT:
    'Não entendi 🤔 Toque numa das opções acima ou me envie sua lista de compras (ex.: "2kg arroz, leite, 6 ovos").',
  REPEAT_ORDER_UNAVAILABLE: '🔁 Ainda não tenho nenhum pedido seu pra repetir. Envie sua lista que eu monto o carrinho!',
  AWAITING_LIST_PROMPT: '📝 Pode mandar sua lista de compras — por texto ou áudio.',
  AUDIO_NOT_SUPPORTED_YET: '🎙️ Ainda não consigo ouvir áudios — pode me mandar a lista por texto, por favor?',
  AUDIO_PROCESSING: '🎙️ Recebi seu áudio, só um instante enquanto eu escuto sua lista...',
  LIST_EMPTY_RESULT:
    'Não consegui identificar nenhum item na sua mensagem 🤔 Tenta me mandar algo tipo "2kg arroz, leite, 6 ovos".',
  RESOLVE_PROMPT_PREFIX: 'Encontrei mais de uma opção para',
  RESOLVE_UNEXPECTED_INPUT: 'Por favor, escolha uma das opções da lista acima ☝️',
  BROWSE_PICK_CATEGORY: '🛒 Escolha uma categoria:',
  BROWSE_PICK_PRODUCT: 'Escolha um produto:',
  BROWSE_ASK_QUANTITY: 'Quantos você quer? Pode mandar um número (ex.: "3") ou algo tipo "2kg".',
  BROWSE_QUANTITY_INVALID: 'Não entendi a quantidade 🤔 Manda um número (ex.: "3") ou algo tipo "2kg", por favor.',
  BROWSE_PRODUCT_ADDED: '✅ Adicionado ao carrinho! Quer escolher mais algum produto dessa categoria?',
  BROWSE_EMPTY_CATEGORY: 'Essa categoria está sem produtos disponíveis no momento.',
  BROWSE_NO_CATEGORIES: 'Não há categorias disponíveis no momento.',
  BROWSE_UNEXPECTED_INPUT: 'Por favor, escolha uma opção da lista acima ☝️',
  GOODBYE: '👋 Tudo bem, cancelei o que estávamos fazendo. Quando quiser começar de novo é só chamar!',
  SESSION_EXPIRED_PREFIX: '⏰ Faz um tempo que não conversamos, então recomecei sua sessão.\n\n',
  FALLBACK_STATE_NOT_READY: 'Ainda estou aprendendo essa parte 🙏 Envie "menu" para recomeçar.',
  CART_EMPTY: '🛒 Seu carrinho está vazio. Envie sua lista de compras ou toque em "Ver produtos" pra começar.',
  CART_REVIEW_UNMATCHED_PREFIX: '⚠️ Não encontrei esses itens:',
  CART_SUMMARY_HEADER: '🛒 Seu carrinho:',
  CART_SUMMARY_TOTAL_PREFIX: 'Total:',
  CART_REVIEW_UNEXPECTED_INPUT: 'Por favor, escolha uma das opções acima ☝️',
  EDITING_CART_PICK_ITEM: 'Escolha o item que quer editar:',
  EDITING_CART_ASK_QUANTITY: 'Nova quantidade? Envie 0 para remover o item.',
  EDITING_CART_QUANTITY_INVALID: 'Não entendi a quantidade 🤔 Envie um número (ex.: "2") ou 0 para remover.',
  EDITING_CART_ITEM_UPDATED: '✅ Atualizado!',
  EDITING_CART_ITEM_REMOVED: '🗑️ Item removido do carrinho.',
  EDITING_CART_UNEXPECTED_INPUT: 'Por favor, escolha um item da lista ou "Concluir edição" ☝️',
  CHECKOUT_ASK_DELIVERY_TYPE: 'Como você prefere receber seu pedido?',
  CHECKOUT_ASK_ADDRESS: '📍 Pode me mandar o endereço completo de entrega?',
  CHECKOUT_ASK_PAYMENT: 'Como você vai pagar?',
  CHECKOUT_ASK_RECEIPT_PREFERENCE: 'Como você quer receber a nota/recibo?',
  CHECKOUT_ASK_EMAIL: '📧 Pode me mandar seu e-mail?',
  CHECKOUT_EMAIL_INVALID: 'Esse e-mail não parece válido 🤔 Pode conferir e mandar de novo?',
  CHECKOUT_UNEXPECTED_INPUT: 'Por favor, escolha uma das opções acima ☝️',
  CONFIRMING_SUMMARY_HEADER: '📋 Confira seu pedido:',
  CONFIRMING_ASK: 'Posso confirmar?',
  CONFIRMING_UNEXPECTED_INPUT: 'Por favor, escolha uma das opções acima ☝️',
  ORDER_CONFIRMED_PREFIX: '✅ Pedido confirmado! Código:',
  ORDER_CANCELLED: 'Pedido cancelado. Seu carrinho continua salvo — quando quiser é só chamar de novo!',
  ORDER_INSUFFICIENT_STOCK: '😕 Alguns itens não têm estoque suficiente no momento. Vamos revisar seu carrinho.',
  ORDER_CART_EMPTY_ERROR: 'Seu carrinho está vazio, não dá pra fechar o pedido ainda.',
  REPEAT_ORDER_ADDED: '🔁 Adicionei os itens do seu último pedido no carrinho!',
  REPEAT_ORDER_SKIPPED_PREFIX: '⚠️ Alguns itens não estavam mais disponíveis e foram pulados:',
} as const

export const MENU_BUTTONS = [
  { id: MENU_BUTTON_ID.SEND_LIST, title: '📝 Enviar lista' },
  { id: MENU_BUTTON_ID.BROWSE, title: '🛒 Ver produtos' },
  { id: MENU_BUTTON_ID.REPEAT_ORDER, title: '🔁 Repetir pedido' },
] as const

export const CART_REVIEW_BUTTONS = [
  { id: CART_REVIEW_BUTTON_ID.CHECKOUT, title: '✅ Fechar pedido' },
  { id: CART_REVIEW_BUTTON_ID.ADD_MORE, title: '➕ Adicionar mais' },
  { id: CART_REVIEW_BUTTON_ID.EDIT_CART, title: '✏️ Editar' },
] as const

export const DELIVERY_TYPE_BUTTONS = [
  { id: DELIVERY_TYPE_BUTTON_ID.DELIVERY, title: '🚚 Entrega' },
  { id: DELIVERY_TYPE_BUTTON_ID.PICKUP, title: '🏪 Retirada' },
] as const

export const PAYMENT_METHOD_BUTTONS = [
  { id: PAYMENT_METHOD_BUTTON_ID.PIX, title: '💳 Pix' },
  { id: PAYMENT_METHOD_BUTTON_ID.CARD_ON_DELIVERY, title: '💳 Cartão na entrega' },
  { id: PAYMENT_METHOD_BUTTON_ID.CASH, title: '💵 Dinheiro' },
] as const

export const RECEIPT_PREFERENCE_BUTTONS = [
  { id: RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP, title: '📱 WhatsApp' },
  { id: RECEIPT_PREFERENCE_BUTTON_ID.EMAIL, title: '📧 E-mail' },
  { id: RECEIPT_PREFERENCE_BUTTON_ID.BOTH, title: '📱📧 Ambos' },
] as const

export const CONFIRMING_BUTTONS = [
  { id: CONFIRMING_BUTTON_ID.CONFIRM, title: '✅ Confirmar' },
  { id: CONFIRMING_BUTTON_ID.CANCEL, title: '❌ Cancelar' },
] as const
