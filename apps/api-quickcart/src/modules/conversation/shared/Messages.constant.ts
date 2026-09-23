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

/**
 * Linhas de "o que você quer mudar?".
 *
 * Lista, e não botões: o WhatsApp permite três botões, e os itens do fechamento são quatro mais a
 * saída. Cortar um item para caber nos botões faria justamente o item cortado voltar a exigir o
 * caminho longo inteiro.
 */
export const CHECKOUT_CHANGE_ROW_ID = {
  DELIVERY_TYPE: 'checkout_change_delivery_type',
  ADDRESS: 'checkout_change_address',
  PAYMENT: 'checkout_change_payment',
  RECEIPT: 'checkout_change_receipt',
  NONE: 'checkout_change_none',
} as const

export const EMAIL_CONFIRMATION_BUTTON_ID = {
  USE_SAVED: 'email_use_saved',
  USE_ANOTHER: 'email_use_another',
} as const

export const CART_RESUME_BUTTON_ID = {
  CONTINUE: 'cart_resume_continue',
  START_OVER: 'cart_resume_start_over',
} as const

export const CART_REVIEW_BUTTON_ID = {
  CHECKOUT: 'checkout',
  ADD_MORE: 'add_more',
  EDIT_CART: 'edit_cart',
} as const

/** Título das linhas de paginação, iguais em toda lista interativa (categoria, busca, resolução, carrinho). */
export const NEXT_PAGE_ROW_TITLE = '➡️ Próxima página'
export const PREVIOUS_PAGE_ROW_TITLE = '⬅️ Página anterior'

export const BROWSE_ROW_ID = {
  NEXT_PAGE: 'next_page',
  PREVIOUS_PAGE: 'previous_page',
  /** Avança a busca por texto livre feita durante a navegação — distinto de `NEXT_PAGE` (paginação de categoria). */
  NEXT_SEARCH_PAGE: 'next_search_page',
  PREVIOUS_SEARCH_PAGE: 'previous_search_page',
} as const

export const BROWSE_ROW_PREFIX = {
  CATEGORY: 'category:',
  PRODUCT: 'product:',
} as const

/**
 * Botões enviados logo depois de adicionar um produto (spec: relato do cliente que ficou preso
 * depois de dizer "Não" a "quer mais algum produto?"). Três, o teto do WhatsApp — nunca reenvia a
 * lista de produtos sozinha, que era o que escondia a saída.
 */
export const BROWSE_POST_ADD_BUTTON_ID = {
  MORE_CATEGORY: 'browse_more_category',
  OTHER_CATEGORY: 'browse_other_category',
  VIEW_CART: 'browse_view_cart',
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
  /** Muda a página da lista de candidatos do item pendente atual, sem mexer na fila. */
  NEXT_PAGE: 'resolve_next_page',
  PREVIOUS_PAGE: 'resolve_previous_page',
} as const

export const RESOLVE_ROW_PREFIX = {
  PRODUCT: 'product:',
} as const

export const EDITING_CART_ROW_ID = {
  DONE: 'done_editing',
  NEXT_PAGE: 'editing_cart_next_page',
  PREVIOUS_PAGE: 'editing_cart_previous_page',
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

/** Resposta sim/não sobre troco no pagamento em dinheiro (roteiro §9). */
export const CASH_CHANGE_BUTTON_ID = {
  NOT_NEEDED: 'cash_change_not_needed',
  NEEDED: 'cash_change_needed',
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

/** Saídas quando o endereço não serve para entrega (fora do raio, sem cotação, texto sem CEP). */
export const ADDRESS_DECISION_BUTTON_ID = {
  PICKUP_INSTEAD: 'address_pickup_instead',
  OTHER_ADDRESS: 'address_other',
} as const

/** Decisão do endereço aproximado (D3): confirmar o endereço antes de cobrar a maior faixa. */
export const APPROXIMATE_ADDRESS_BUTTON_ID = {
  SEND_LOCATION: 'approximate_send_location',
  CHANGE_ADDRESS: 'approximate_change_address',
  CONFIRM_ESTIMATE: 'approximate_confirm_estimate',
} as const

export const CONFIRMING_BUTTON_ID = {
  CONFIRM: 'confirm_order',
  EDIT: 'edit_order',
  CANCEL: 'cancel_order',
} as const

/**
 * Frases de encerramento digitadas durante a navegação (`browsing_categories`) — todas levam ao
 * carrinho pelo MESMO caminho do gatilho "carrinho" de sempre (`enterCartReview`). Relato real: o
 * cliente disse "Não" a "quer mais algum produto?" e caiu em "Não encontrei 'Não' 🤔", sem saída
 * visível. Casamento é por FRASE INTEIRA depois de normalizar (minúsculas, sem acento, sem
 * pontuação) — nunca substring: "não tem arroz integral?" continua sendo busca de produto
 * (`isCartDoneRequest`).
 */
export const BROWSE_CART_DONE_WORDS = [
  'nao',
  'pronto',
  'so isso',
  'e so isso',
  'finalizar',
  'concluir',
  'terminei',
  'fechar',
  'fechar pedido',
  'acabou',
  'nada',
  'ver carrinho',
  'carrinho',
] as const

export const GLOBAL_TRIGGER = {
  EXIT_WORDS: ['sair', 'cancelar'],
} as const

/**
 * Frases que pedem gente de verdade, em QUALQUER estado (spec §3.5, T3.1).
 *
 * Casamento é por mensagem inteira ou pelo prefixo "falar com" (ver `isHumanHandoffRequest`),
 * nunca substring — "o atendente de ontem errou meu pedido" não é pedido de transferência.
 */
export const HUMAN_HANDOFF_PHRASES = [
  'atendente',
  'humano',
  'pessoa',
  'falar com atendente',
  'falar com alguém',
  'falar com uma pessoa',
  'quero um atendente',
] as const

/**
 * A decisão do cliente sobre um pedido com item em falta. O id carrega o pedido: `order_continue:<uuid>`.
 *
 * Carrega porque a pergunta pode ficar sem resposta por horas, e nesse meio-tempo a pessoa conversa sobre
 * outra coisa — um id solto (`continue`) seria aplicado ao pedido que a sessão achasse "atual", que pode
 * não ser o da pergunta. Com o id dentro do botão, a resposta vale para o pedido que a produziu, sempre.
 */
export const ORDER_DECISION_BUTTON_PREFIX = {
  /** Segue com o que sobrou. */
  CONTINUE: 'order_continue:',
  /** Desiste do pedido. Cancela na hora — a loja é avisada, não consultada. */
  CANCEL: 'order_cancel:',
  /** Só existe quando NADA sobrou: cancela este e abre a conversa para uma lista nova. */
  NEW_LIST: 'order_new_list:',
  /**
   * Aceita o parecido oferecido. Carrega três ids: `order_swap:<pedido>:<item>:<produto>`.
   *
   * Três porque a pergunta é sobre UM item e propõe UM produto, e nenhum dos dois dá para inferir depois:
   * o pedido pode ter outras faltas, e o candidato do momento da oferta não é necessariamente o que a
   * mesma busca devolveria horas depois — o estoque mudou no meio.
   */
  SUBSTITUTE: 'order_swap:',
  /** Recusa o parecido e segue sem aquele item: `order_skip_item:<pedido>:<item>`. */
  SKIP_ITEM: 'order_skip_item:',
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
  IMAGE_PRODUCT_NOT_FOUND:
    '📷 Não consegui identificar esse produto pela foto. Pode me dizer o nome dele, ou mandar outra foto com a embalagem de frente?',
  IMAGE_PRODUCT_CANDIDATES: '📷 Encontrei mais de um parecido. É algum destes? Me diga o nome ou o número:',
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
  BROWSE_QUANTITY_INVALID:
    'Não entendi a quantidade 🤔 Manda um número (ex.: "3") ou algo tipo "2kg", por favor — ou escreva *carrinho* para ver o que já escolheu.',
  /** `{quantidade}` e `{produto}` substituídos pelo item recém-adicionado. Vem antes dos 3 botões de "e agora?". */
  BROWSE_PRODUCT_ADDED: '✅ Adicionado: {quantidade}× {produto}. E agora?',
  BROWSE_POST_ADD_MORE_CATEGORY: '➕ Mais da categoria',
  BROWSE_POST_ADD_OTHER_CATEGORY: '📂 Outra categoria',
  BROWSE_POST_ADD_VIEW_CART: '🛒 Ver carrinho',
  BROWSE_EMPTY_CATEGORY: 'Essa categoria está sem produtos disponíveis no momento.',
  BROWSE_NO_CATEGORIES: 'Não há categorias disponíveis no momento.',
  BROWSE_UNEXPECTED_INPUT: 'Por favor, escolha uma opção da lista acima ☝️ ou escreva *carrinho* para ver o que já escolheu.',
  BROWSE_SEARCH_RESULTS: 'Encontrei estes para "{termo}":',
  BROWSE_SEARCH_NOT_FOUND: 'Não encontrei "{termo}" 🤔 Tenta outro nome ou escolha uma opção da lista acima ☝️',
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
   * Pedido de atendente enquanto um atendente JÁ assumiu a conversa (`mode: 'human'`).
   *
   * `humanRequestedAt` não serve para deduplicar: o `@adatechnology/meta-whatsapp-module` nunca o
   * limpa (nem `release`, nem `takeover`), então um pedido de semanas atrás — já resolvido e
   * devolvido ao bot — pareceria "já pedido" para sempre. `mode` é confiável: só muda em
   * `takeover`/`release`.
   */
  AGENT_HUMAN_IN_PROGRESS: 'Você já está falando com a nossa equipe — é só mandar sua mensagem por aqui.',
  /** Segundo pedido de atendente dentro do cooldown: a equipe já foi avisada, não reenfileira. */
  AGENT_ALREADY_NOTIFIED: 'Já avisei a equipe — em instantes alguém te responde.',
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
    '😕 Acabou tudo do seu pedido *{codigo}*:\n\n{itens}\n\nNão sobrou nada para entregar. Quer montar outra lista?',
  ORDER_ITEMS_UNAVAILABLE:
    '😕 Faltou item no seu pedido *{codigo}*:\n\n{itens}\n\nO novo total fica *{total}*. Seguimos com o resto?',
  /**
   * O mesmo aviso, sem pergunta: a loja decidiu seguir e está informando, não consultando.
   *
   * Sem botão de propósito. Botão pede resposta, e resposta que ninguém vai esperar é pior que aviso
   * nenhum — o cliente clica, o pedido já saiu para entrega, e o clique não muda nada. Aqui ele fica
   * sabendo e tem um convite claro para falar com a loja se quiser mudar algo.
   */
  ORDER_ITEMS_UNAVAILABLE_NOTICE:
    '😕 Faltou item no seu pedido *{codigo}*:\n\n{itens}\n\nSigo com o restante e o novo total fica *{total}*. Se quiser mudar alguma coisa, é só me chamar por aqui.',
  /**
   * A cobrança única, colada na frente da MESMA pergunta.
   *
   * Repetir o texto inteiro é de propósito: horas depois o cliente não rola a conversa para relembrar o
   * que faltava, e uma cobrança sem o conteúdo ("e aí?") pede decisão sobre algo que ele não tem à vista.
   */
  ORDER_DECISION_REMINDER_PREFIX: '⏳ Ainda preciso da sua resposta para seguir com a compra.\n\n',
  ORDER_DECISION_CONTINUE_ACK:
    '✅ Combinado! Seguimos com o restante do pedido *{codigo}*. Te aviso quando estiver pronto.',
  ORDER_DECISION_CANCELLED_ACK:
    '❌ Pedido *{codigo}* cancelado, e a loja já foi avisada. Quando quiser comprar de novo é só me chamar!',
  ORDER_DECISION_NEW_LIST_ACK:
    '🛒 Cancelei o pedido *{codigo}*. Me manda a nova lista (texto ou áudio) que eu já monto seu carrinho.',
  /**
   * A oferta do parecido, um item por vez (ADR 0003).
   *
   * O nome do produto vai no CORPO e não no botão: "🔄 Trocar" cabe nos 20 caracteres do título, e
   * "Piracanjuba Integral 1L" tem 23 sem emoji — a Meta recusaria a mensagem inteira.
   *
   * O preço vem junto porque trocar por algo mais caro sem dizer quanto é cobrar sem avisar.
   */
  ORDER_ITEM_SUBSTITUTE_OFFER:
    '😕 Faltou *{item}* no pedido *{codigo}*.\n\nTenho *{substituto}* por *{preco}*{diferenca}.\n\nQuer trocar?',
  /**
   * A mesma oferta quando há mais de um parecido no estoque (ADR 0003).
   *
   * Os parecidos vão no CORPO, e não só nas linhas da lista: quem lê no preview da notificação precisa
   * ver o que está sendo oferecido e por quanto antes de abrir a lista para escolher.
   */
  ORDER_ITEM_SUBSTITUTE_OFFER_MULTI:
    '😕 Faltou *{item}* no pedido *{codigo}*.\n\nTenho estes parecidos:\n\n{opcoes}\n\nQual você quer?',
  /** Uma linha por parecido no corpo da oferta múltipla. */
  ORDER_ITEM_SUBSTITUTE_OPTION_LINE: '{posicao}. *{substituto}* — *{preco}*{diferenca}',
  /** Título do botão que abre a lista de parecidos. Teto de 20 caracteres da Meta. */
  ORDER_ITEM_SUBSTITUTE_LIST_BUTTON: 'Ver parecidos',
  /** Título da seção da lista de parecidos. Teto de 24 caracteres. */
  ORDER_ITEM_SUBSTITUTE_LIST_SECTION: 'Parecidos',
  /** Entra no lugar de `{diferenca}` quando os preços diferem. Vazio quando são iguais — nada a avisar. */
  ORDER_ITEM_SUBSTITUTE_PRICE_DIFFERENCE: ' ({sinal}{valor} no total)',
  ORDER_ITEM_SUBSTITUTED_ACK: '🔄 Trocado! *{substituto}* entra no lugar. O total do *{codigo}* fica *{total}*.',
  ORDER_ITEM_SKIPPED_ACK: '👍 Certo, sigo sem *{item}*.',
  /**
   * O substituto acabou entre a oferta e o toque. Não é erro: o desfecho é o mesmo que recusar.
   *
   * Dizer o que aconteceu, e não só "não deu": o cliente aceitou uma troca e vai receber a sacola sem
   * ela — descobrir isso na porta é o que esta frase evita.
   */
  ORDER_ITEM_SUBSTITUTE_GONE:
    '😕 O parecido que te ofereci acabou agorinha — alguém levou o último. Sigo sem *{item}*.',
  /** Chegou uma resposta para um pedido que já andou — a loja resolveu antes, ou o botão foi tocado duas vezes. */
  ORDER_DECISION_ALREADY_RESOLVED: 'Esse pedido já foi resolvido — não precisa responder de novo 🙂',
  ORDER_HISTORY_EMPTY: 'Você ainda não tem compra fechada por aqui. Quando tiver, ela aparece nesta opção.',
  ORDER_HISTORY_HEADER: '📜 Suas últimas compras:',
  LIST_INTENT_DETECTED: '📝 Entendi que é uma lista! Já vou montar seu carrinho…',
  GOODBYE: '👋 Tudo bem, cancelei o que estávamos fazendo. Quando quiser começar de novo é só chamar!',
  SESSION_EXPIRED_PREFIX: '⏰ Faz um tempo que não conversamos, então recomecei sua sessão.\n\n',
  /**
   * `{codigo}` e `{itens}` preenchidos pelo CartResumeHandler.
   *
   * O número de itens vem antes da pergunta de propósito: quem voltou depois de horas não lembra o
   * que tinha na lista, e "continuar" sem saber o tamanho do que se está continuando é um chute.
   */
  CART_RESUME_ASK:
    '⏰ Faz um tempo que não conversamos.\n\nVocê tinha uma compra começada (*{codigo}*) com {itens}. Quer continuar de onde parou ou começar do zero?',
  CART_RESUME_CONTINUED: '👍 Beleza, continuando a compra *{codigo}*.',
  CART_RESUME_STARTED_OVER: '🧹 Pronto, comecei uma compra nova: *{codigo}*. A lista anterior foi descartada.',
  /** Rótulo do pino no mapa. Curto porque o WhatsApp o mostra sob o quadradinho, junto do endereço. */
  CONFIRMING_SUMMARY_MAP_PIN_NAME: 'Entrega do seu pedido',
  CHECKOUT_CHANGE_ASK: 'O que você quer mudar?',
  CHECKOUT_CHANGE_LIST_BUTTON: 'Escolher',
  CHECKOUT_CHANGE_SECTION_TITLE: 'Fechamento',
  CHECKOUT_CHANGE_UNEXPECTED_INPUT: 'Escolha um item da lista acima ☝️',
  /** `{email}` preenchido pelo CheckoutHandler — o cliente lê o endereço inteiro antes de aceitar. */
  CHECKOUT_CONFIRM_SAVED_EMAIL: '📧 Mando a nota para *{email}*?',
  FALLBACK_STATE_NOT_READY: 'Ainda estou aprendendo essa parte 🙏 Envie "menu" para recomeçar.',
  CART_EMPTY: '🛒 Seu carrinho está vazio. Envie sua lista de compras ou toque em "Ver produtos" pra começar.',
  CART_REVIEW_UNMATCHED_PREFIX: '⚠️ Não encontrei esses itens:',
  CART_SUMMARY_HEADER: '🛒 Seu carrinho:',
  /** No carrinho ainda não há taxa (T2.2): "Subtotal" evita confundir com o valor final cobrado. */
  CART_SUMMARY_TOTAL_PREFIX: 'Subtotal:',
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
  CHECKOUT_ASK_ADDRESS: '📍 Pode me mandar o CEP do endereço de entrega? Se preferir, envie sua localização pelo 📎.',
  /** CEP que não resolve: sem ele não há como cotar a faixa, então o texto livre não é mais aceito. */
  CHECKOUT_ASK_ADDRESS_FALLBACK:
    'Não achei esse CEP 🤔 Confere e me manda de novo, ou envie sua localização pelo 📎. Se preferir, retire na loja.',
  /** Endereço em texto livre: a taxa depende da distância, e ela só sai de um CEP ou de uma localização. */
  CHECKOUT_ADDRESS_NEEDS_CEP_OR_LOCATION:
    'Para calcular a taxa de entrega preciso do CEP (8 números) ou da sua localização pelo 📎. Se preferir, retire na loja.',
  CHECKOUT_ASK_ADDRESS_NUMBER: 'Qual o número? (e o complemento, se tiver — ex: "412, apto 71")',
  /** A localização dá a coordenada, não a porta: o entregador ainda precisa do número e da referência. */
  CHECKOUT_ASK_LOCATION_ADDRESS_NUMBER:
    'Recebi sua localização! 📍 Qual o número e o complemento ou ponto de referência para o entregador? (ex: "412, apto 71")',
  /** `{distancia}` em km com uma casa; `{valor}` a taxa da faixa. Vem antes da pergunta do pagamento. */
  CHECKOUT_DELIVERY_FEE_QUOTED: 'Taxa de entrega para seu endereço ({distancia} km): {valor}',
  /** CEP que só localiza a cidade (D3): cobra a maior faixa e diz que é estimativa. */
  CHECKOUT_DELIVERY_FEE_APPROXIMATE: 'Taxa de entrega para seu endereço (estimativa pela cidade): {valor}',
  CHECKOUT_DELIVERY_OUT_OF_RANGE:
    'Seu endereço fica a ~{distancia} km e entregamos até {limite} km 😕 Quer retirar na loja ou informar outro endereço?',
  CHECKOUT_DELIVERY_UNAVAILABLE:
    'Não consegui calcular a distância até seu endereço agora 😕 Quer retirar na loja ou informar outro endereço?',
  CHECKOUT_OUT_OF_RANGE_UNEXPECTED_INPUT: 'Por favor, escolha: retirar na loja ou informar outro endereço ☝️',
  /**
   * D3, decisão do usuário: cobrar a maior faixa em silêncio é cobrar a mais sem avisar. O cliente vê
   * o endereço encontrado (`{endereco}`: rua, bairro e cidade — nunca o CEP completo) e escolhe.
   */
  CHECKOUT_APPROXIMATE_ADDRESS_DECISION:
    'Encontrei este endereço:\n{endereco}\n\nMas não consegui a localização exata dele, então não sei a distância certa até a loja 🤔 Como prefere seguir?',
  /** Uma linha só: o caminho para mandar a localização no WhatsApp. */
  CHECKOUT_APPROXIMATE_ASK_LOCATION:
    'Toque no 📎 aqui embaixo, escolha *Localização* e envie a sua — assim calculo a distância exata 📍',
  CHECKOUT_APPROXIMATE_UNEXPECTED_INPUT:
    'Não entendi 🤔 Escolha uma das opções abaixo, ou me mande outro CEP (8 números).',
  /** Segunda resposta fora do esperado: explica as opções em vez de repetir a mesma pergunta. */
  CHECKOUT_APPROXIMATE_HELP:
    'Você pode tocar em *Enviar localização* para eu calcular a distância exata, em *Alterar endereço* para mandar outro CEP ou localização, ou em *Retirar na loja*.',
  /** Fallback: a localização não veio em duas tentativas, então a estimativa volta à mesa (com o preço). */
  CHECKOUT_APPROXIMATE_ESTIMATE_OFFER:
    'Ainda não recebi sua localização 😕 Se preferir, posso seguir com a estimativa pela cidade: a taxa de entrega ficaria em {valor}. Confirma?',
  /** "Isso mesmo" com entrega que não deu para recotar: o atalho cai e o cliente escolhe de novo. */
  CHECKOUT_REMEMBERED_DELIVERY_NOT_QUOTED:
    'Não consegui confirmar a taxa de entrega para o endereço da última vez, então vamos escolher de novo.',
  /** Sessão de antes da taxa por faixa: a entrega não tem cotação e o endereço precisa ser informado de novo. */
  CHECKOUT_DELIVERY_QUOTE_MISSING:
    'A taxa de entrega agora depende do endereço. 📍 Pode me mandar o CEP ou sua localização pelo 📎?',
  CHECKOUT_ASK_PAYMENT: 'Como você vai pagar?',
  /**
   * Enviada ao escolher "Cartão na entrega", antes de seguir o fluxo normal (roteiro §11, spec §3.2).
   *
   * Só faz sentido na entrega: quem retira na loja paga no caixa, sem entregador nem maquininha —
   * por isso `handleAwaitingPayment` só manda esta linha quando `checkoutDeliveryType === delivery`.
   */
  CHECKOUT_CARD_ON_DELIVERY_MACHINE_NOTICE:
    'Certo! O pagamento é feito na entrega, no crédito ou débito — nosso entregador leva a maquininha.',
  /** Só perguntado quando o pagamento escolhido é em dinheiro (roteiro §9). */
  CHECKOUT_ASK_CASH_CHANGE: 'Precisa de troco?',
  CHECKOUT_ASK_CASH_CHANGE_AMOUNT:
    'Troco para quanto? Ex.: se a compra deu R$ 132,50 e você vai pagar com R$ 150,00, responda 150.',
  /** Mesma pergunta com o total à vista, para o cliente não ter de rolar a conversa. `{total}` é o total a pagar. */
  CHECKOUT_ASK_CASH_CHANGE_AMOUNT_WITH_TOTAL:
    'Sua compra deu {total} (itens + entrega).\nTroco para quanto? Ex.: se você vai pagar com R$ 250,00, responda 250.',
  CHECKOUT_CASH_CHANGE_INVALID: 'Não entendi esse valor 🤔 Pode me mandar só o número? Ex.: 150.',
  /** `{total}` é o total a pagar — a mensagem some se o troco pedido não cobrir a compra. */
  CHECKOUT_CASH_CHANGE_TOO_LOW: 'Esse valor não cobre a compra de {total}. Troco para quanto?',
  /** Ao confirmar, o total recalculado passou do troco aceito antes (preço mudou): pergunta de novo. */
  CHECKOUT_CASH_CHANGE_TOTAL_CHANGED: 'O total da compra mudou para {total}. Troco para quanto?',
  CHECKOUT_ASK_RECEIPT_PREFERENCE: 'Como você quer receber a nota/recibo?',
  CHECKOUT_ASK_EMAIL: '📧 Pode me mandar seu e-mail?',
  CHECKOUT_EMAIL_INVALID: 'Esse e-mail não parece válido 🤔 Pode conferir e mandar de novo?',
  CHECKOUT_UNEXPECTED_INPUT: 'Por favor, escolha uma das opções acima ☝️',
  CONFIRMING_SUMMARY_HEADER: '📋 Confira seu pedido:',
  CONFIRMING_SUMMARY_ITEMS_LABEL: 'Itens:',
  /** Resumo antes de confirmar (spec §3.4): subtotal dos itens, sem a taxa. */
  CONFIRMING_SUMMARY_SUBTOTAL_PREFIX: 'Subtotal:',
  /** `{valor}` é a taxa formatada; ausente por completo na retirada (taxa 0 não basta — a linha não aparece). */
  CONFIRMING_SUMMARY_DELIVERY_FEE_PREFIX: 'Taxa de entrega:',
  /** Cotação com distância conhecida (T3.2, spec §3.4/§3.6): mostra a faixa e a distância no resumo. */
  CONFIRMING_SUMMARY_DELIVERY_FEE_QUOTED_PREFIX: 'Taxa de entrega (até {limite} km · {distancia} km):',
  /** Precisão de cidade (D3): sem distância da casa, só a faixa cobrada. */
  CONFIRMING_SUMMARY_DELIVERY_FEE_APPROXIMATE_PREFIX: 'Taxa de entrega (estimativa pela cidade, até {limite} km):',
  /** Taxa configurada em zero: mostra "grátis" em vez de "R$ 0,00". */
  CONFIRMING_SUMMARY_DELIVERY_FEE_FREE: 'grátis',
  /** `{valor}` = itens + taxa (`amountDueInCents`) — o que será cobrado, nunca só o total dos itens. */
  CONFIRMING_SUMMARY_TOTAL_PREFIX: 'Total:',
  CONFIRMING_SUMMARY_DELIVERY_PREFIX: 'Entrega:',
  /** Confere o ponto antes de confirmar: se o mapa cair no lugar errado, o botão de alterar ainda está ali. `{url}` é o link do mapa. */
  CONFIRMING_SUMMARY_MAP_LINE: '📍 Confira no mapa: {url}',
  CONFIRMING_SUMMARY_PICKUP_LABEL: 'Retirada na loja',
  CONFIRMING_SUMMARY_PAYMENT_PREFIX: 'Pagamento:',
  CONFIRMING_SUMMARY_RECEIPT_PREFIX: 'Recibo:',
  CONFIRMING_ASK: 'Posso confirmar?',
  CONFIRMING_UNEXPECTED_INPUT: 'Por favor, escolha uma das opções acima ☝️',
  /** Sufixo do pagamento no resumo e na confirmação, quando há troco. `{valor}` é o valor pago. */
  CASH_CHANGE_SUMMARY_SUFFIX: ' — troco para {valor}',
  ORDER_CONFIRMED_PREFIX: '✅ Pedido confirmado! Código:',
  /** Valor cobrado: itens + taxa de entrega (`amountDueInCents`), não o `total_in_cents` da nota. */
  ORDER_CONFIRMED_TOTAL_LINE: 'Total: {total}.',
  /** Linha de troco na confirmação final. `{valor}` é o valor com que o cliente vai pagar. */
  ORDER_CONFIRMED_CASH_CHANGE_LINE: 'Troco para {valor}.',
  /** Roteiro §12. Ausente sempre que não dá para responder com honestidade — nunca inventar. */
  ORDER_CONFIRMED_DELIVERY_ESTIMATE_LINE: 'Previsão de entrega: entre {min} e {max} minutos.',
  /** Retirada usa `STORE_PREPARATION_MINUTES`, não a estimativa de rota. */
  ORDER_CONFIRMED_PICKUP_ESTIMATE_LINE: 'Pronto para retirada em cerca de {minutos} minutos.',
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

export const EMAIL_CONFIRMATION_BUTTONS = [
  { id: EMAIL_CONFIRMATION_BUTTON_ID.USE_SAVED, title: '✅ Pode mandar' },
  { id: EMAIL_CONFIRMATION_BUTTON_ID.USE_ANOTHER, title: '✏️ Outro e-mail' },
] as const

export const CART_RESUME_BUTTONS = [
  { id: CART_RESUME_BUTTON_ID.CONTINUE, title: '▶️ Continuar' },
  { id: CART_RESUME_BUTTON_ID.START_OVER, title: '🆕 Começar do zero' },
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

export const CASH_CHANGE_BUTTONS = [
  { id: CASH_CHANGE_BUTTON_ID.NOT_NEEDED, title: '🙅 Não preciso' },
  { id: CASH_CHANGE_BUTTON_ID.NEEDED, title: '💵 Preciso de troco' },
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

const PICKUP_INSTEAD_BUTTON = { id: ADDRESS_DECISION_BUTTON_ID.PICKUP_INSTEAD, title: '🏪 Retirar na loja' } as const

export const ADDRESS_PICKUP_INSTEAD_BUTTONS = [PICKUP_INSTEAD_BUTTON] as const

export const OUT_OF_RANGE_DECISION_BUTTONS = [
  PICKUP_INSTEAD_BUTTON,
  { id: ADDRESS_DECISION_BUTTON_ID.OTHER_ADDRESS, title: '📍 Outro endereço' },
] as const

export const APPROXIMATE_ADDRESS_DECISION_BUTTONS = [
  { id: APPROXIMATE_ADDRESS_BUTTON_ID.SEND_LOCATION, title: '📍 Enviar localização' },
  { id: APPROXIMATE_ADDRESS_BUTTON_ID.CHANGE_ADDRESS, title: '✏️ Alterar endereço' },
  PICKUP_INSTEAD_BUTTON,
] as const

export const APPROXIMATE_ESTIMATE_BUTTONS = [
  { id: APPROXIMATE_ADDRESS_BUTTON_ID.CONFIRM_ESTIMATE, title: '✅ Confirmar' },
  PICKUP_INSTEAD_BUTTON,
] as const

export const CONFIRMING_BUTTONS = [
  { id: CONFIRMING_BUTTON_ID.CONFIRM, title: '✅ Confirmar' },
  { id: CONFIRMING_BUTTON_ID.EDIT, title: '✏️ Alterar' },
  { id: CONFIRMING_BUTTON_ID.CANCEL, title: '❌ Cancelar' },
] as const
