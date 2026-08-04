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
  /** Histórico: navegar e escolher. Não substitui `REPEAT_ORDER`, que é um toque até o carrinho. */
  ORDER_HISTORY: 'order_history',
  /**
   * Saída para gente de verdade. Sem ela, quem o bot não entende fica preso repetindo — e é justamente
   * quem já está irritado.
   */
  TALK_TO_AGENT: 'talk_to_agent',
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
  /**
   * "Tanto faz" — o cliente delega a escolha, em vez de o bot decidir por ele.
   *
   * Só aparece quando os candidatos são equivalentes (mesmo produto e tamanho, muda a marca): aí
   * "escolha" é uma pergunta sem conteúdo para quem disse "leite" e quer leite. Entre coisas
   * diferentes de verdade — leite de caixinha e leite em pó — a linha NÃO aparece, porque "o mais
   * barato" ali escolheria outro produto sem o cliente perceber.
   */
  CHEAPEST: 'resolve_cheapest',
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

/**
 * Atalho do cliente que já comprou: aceitar as escolhas da última vez, ou refazer uma por uma.
 *
 * Duas opções e não uma: aceitar por omissão (só "confirmar") esconderia a mudança de quem quer mudar,
 * e o pedido erra em silêncio.
 */
export const REMEMBERED_CHECKOUT_BUTTON_ID = {
  SAME_AS_LAST: 'same_as_last',
  CHANGE_PREFERENCES: 'change_preferences',
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
  /**
   * Texto do menu. NÃO reapresenta o bot: a saudação já aconteceu no nó anterior — "Prazer, João!"
   * para quem chegou agora, "Oi de novo, João!" para quem volta. Repetir "Olá! Eu sou o assistente"
   * aqui fazia o cliente ser cumprimentado duas vezes seguidas.
   *
   * Mantém o convite a mandar a lista: é o caminho principal do produto, e texto ou áudio soltos já
   * caem nele sem precisar de botão.
   */
  MENU_PROMPT:
    'O que você prefere? Pode me mandar sua lista (texto ou áudio) que eu monto seu carrinho, ou escolher abaixo:',
  // Primeiro contato: pergunta o nome antes de qualquer coisa. Sem nome, toda mensagem seguinte
  // trata o cliente como desconhecido — e o atendente que assume no meio herda isso.
  ASK_NAME: '👋 Olá! Eu sou o assistente de compras do QuickCart. Antes de começar, como você se chama?',
  // `{nome}` é trocado pela ação de saudação. Cliente que volta não deve reapresentar-se.
  WELCOME_BACK: '👋 Oi de novo, {nome}! Que bom te ver por aqui. Como posso ajudar hoje?',
  // Recusa sem sermão: repetir o pedido é mais útil que explicar a regra.
  NAME_REJECTED: '😅 Esse não parece um nome. Como você se chama de verdade?',
  NAME_TOO_SHORT: 'Só para eu não errar: me diz seu nome com pelo menos duas letras?',
  NAME_ACCEPTED: 'Prazer, {nome}! 🙂',
  /**
   * Entrada no catálogo. Antes esta ação reusava o `MENU_HINT`, cujo texto é "Não entendi 🤔" — o
   * cliente tocava no botão certo e levava uma mensagem de erro.
   */
  BROWSE_CATALOG_PROMPT: '🛒 Beleza! Vou te mostrar as categorias — só um instante.',
  MENU_HINT:
    'Não entendi 🤔 Toque numa das opções acima ou me envie sua lista de compras (ex.: "2kg arroz, leite, 6 ovos").',
  REPEAT_ORDER_UNAVAILABLE: '🔁 Ainda não tenho nenhum pedido seu pra repetir. Envie sua lista que eu monto o carrinho!',
  AWAITING_LIST_PROMPT: '📝 Pode mandar sua lista de compras — por texto ou áudio.',
  AUDIO_NOT_SUPPORTED_YET: '🎙️ Ainda não consigo ouvir áudios — pode me mandar a lista por texto, por favor?',
  AUDIO_PROCESSING: '🎙️ Recebi seu áudio, só um instante enquanto eu escuto sua lista...',
  LIST_EMPTY_RESULT:
    'Não consegui identificar nenhum item na sua mensagem 🤔 Tenta me mandar algo tipo "2kg arroz, leite, 6 ovos".',
  RESOLVE_PROMPT_PREFIX: 'Encontrei mais de uma opção para',
  /** Rótulo da linha de delegação. Diz o critério, para o cliente saber o que está aceitando. */
  RESOLVE_CHEAPEST_LABEL: '🤷 Tanto faz — o mais barato',
  RESOLVE_CHEAPEST_CONFIRMATION: 'Beleza, peguei {produto} por {preco}.',
  RESOLVE_UNEXPECTED_INPUT: 'Por favor, escolha uma das opções da lista acima ☝️',
  BROWSE_PICK_CATEGORY: '🛒 Escolha uma categoria:',
  BROWSE_PICK_PRODUCT: 'Escolha um produto:',
  BROWSE_ASK_QUANTITY: 'Quantos você quer? Pode mandar um número (ex.: "3") ou algo tipo "2kg".',
  BROWSE_QUANTITY_INVALID: 'Não entendi a quantidade 🤔 Manda um número (ex.: "3") ou algo tipo "2kg", por favor.',
  BROWSE_PRODUCT_ADDED: '✅ Adicionado ao carrinho! Quer escolher mais algum produto dessa categoria?',
  BROWSE_EMPTY_CATEGORY: 'Essa categoria está sem produtos disponíveis no momento.',
  BROWSE_NO_CATEGORIES: 'Não há categorias disponíveis no momento.',
  BROWSE_UNEXPECTED_INPUT: 'Por favor, escolha uma opção da lista acima ☝️',
  /**
   * Dito antes de montar carrinho a partir de uma lista que ninguém pediu.
   *
   * O bot muda de assunto por conta própria aqui — a pessoa estava vendo categorias e vai receber um
   * carrinho. Sem avisar, parece que o menu quebrou; avisando, fica claro que ele entendeu.
   */
  /**
   * Dito ao pedir atendente. Promete o que o produto cumpre — a conversa entra na fila da inbox com
   * o marcador de espera — e deixa claro que o bot NÃO vai calar a boca no meio.
   *
   * Silenciar o bot aqui seria a escolha errada: quem pediu ajuda receberia silêncio até alguém
   * aparecer, e com a loja fechada isso é a madrugada inteira. Fila marcada, atendimento seguindo.
   */
  AGENT_REQUESTED: '💬 Já avisei a equipe — alguém vai te responder por aqui. Enquanto isso posso seguir te ajudando.',
  /**
   * Aviso de item que acabou. Diz o produto, o total novo e devolve a decisão ao cliente.
   *
   * Não pergunta "quer cancelar?" de propósito: a maioria segue com o resto da compra, e oferecer o
   * cancelamento primeiro sugere que a loja preferiria desfazer tudo. Quem quiser cancelar pede.
   */
  /**
   * Aviso ÚNICO com todas as faltas. Enviado quando a loja decide avisar, não a cada marcação.
   *
   * Não abre oferecendo cancelamento de propósito: a maioria segue com o resto da compra, e começar por
   * "quer cancelar?" sugere que a loja preferiria desfazer tudo.
   */
  /**
   * Quando NADA sobrou. Pedido de total zero não é pedido, e tratá-lo como os outros faria o cliente
   * receber "o novo total é R$ 0,00" e ficar esperando uma entrega vazia.
   */
  ORDER_ALL_ITEMS_UNAVAILABLE:
    '😕 Infelizmente todos os itens do seu pedido acabaram no estoque:\n\n{itens}\n\nNão vai dar para entregar nada assim. Quer montar outra lista ou prefere cancelar? Me diz por aqui.',
  ORDER_ITEMS_UNAVAILABLE:
    '😕 Alguns itens do seu pedido acabaram no estoque e não vão na entrega:\n\n{itens}\n\nO novo total é {total}. Se quiser trocar por outra coisa ou cancelar, me diz por aqui.',
  ORDER_HISTORY_EMPTY: 'Você ainda não tem compra fechada por aqui. Quando tiver, ela aparece nesta opção.',
  ORDER_HISTORY_HEADER: '📜 Suas últimas compras:',
  LIST_INTENT_DETECTED: '📝 Entendi que é uma lista! Já vou montar seu carrinho…',
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
  /**
   * Pergunta única que substitui quatro, para quem já fechou pedido antes.
   *
   * Mostra o que vai valer ANTES de valer: memória sem transparência é o bot decidindo por conta
   * própria, e um endereço antigo aplicado em silêncio entrega compra na casa errada.
   */
  CHECKOUT_SAME_AS_LAST: 'Da última vez foi assim:\n\n{resumo}\n\nMantenho igual?',
  /**
   * Lista ditada por quem o bot ainda não conhece: anota antes de pedir o nome.
   *
   * Sem esta frase, o cliente manda "quero 3 quilos de feijão" e recebe "como você se chama?" — a
   * lista parece ignorada, e é justamente o que ele veio fazer. Dizer que foi anotada é o que compra
   * a paciência para responder o nome primeiro.
   */
  LIST_SAVED_ASK_NAME_FIRST: '📝 Já anotei sua lista!',
  CHECKOUT_ASK_DELIVERY_TYPE: 'Como você prefere receber seu pedido?',
  /**
   * CEP primeiro (spec §8 Q1): pede 8 dígitos, não o endereço inteiro — rua/bairro/cidade/UF vêm
   * do ViaCEP, e só falta o número.
   */
  CHECKOUT_ASK_ADDRESS: '📍 Pode me mandar o CEP do endereço de entrega?',
  /** CEP não resolveu (ou não parece CEP): não trava, cai para o endereço completo em texto livre. */
  CHECKOUT_ASK_ADDRESS_FALLBACK: 'Não achei esse CEP 🤔 Pode me mandar o endereço completo de entrega?',
  CHECKOUT_ASK_ADDRESS_NUMBER: 'Qual o número? (e o complemento, se tiver — ex: "412, apto 71")',
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

export const REMEMBERED_CHECKOUT_BUTTONS = [
  { id: REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST, title: '✅ Isso mesmo' },
  { id: REMEMBERED_CHECKOUT_BUTTON_ID.CHANGE_PREFERENCES, title: '✏️ Quero mudar' },
] as const

export const CONFIRMING_BUTTONS = [
  { id: CONFIRMING_BUTTON_ID.CONFIRM, title: '✅ Confirmar' },
  { id: CONFIRMING_BUTTON_ID.CANCEL, title: '❌ Cancelar' },
] as const
