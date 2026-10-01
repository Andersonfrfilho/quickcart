/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Tabela completa de estados/handlers: spec §4. `cart_review` em diante (inclusive)
 * pertence à Fase 5 — o ConversationEngine da Fase 4 registra handlers só até
 * `resolving_items`/`browsing_categories`/`awaiting_quantity`; a sessão fica
 * "estacionada" nos demais estados até a Fase 5 registrar os handlers correspondentes.
 */

export const CONVERSATION_STATE = {
  GREETING: 'greeting',
  /**
   * A sessão expirou e o carrinho anterior ainda tem itens: o cliente decide continuar ou recomeçar.
   *
   * Existe porque o carrinho é por cliente, não por conversa: sem esta pergunta, a lista de ontem
   * (ou a da conversa de teste) aparecia somada à de hoje no balcão, sem ninguém ter pedido isso.
   * Continuar preserva o código da compra; começar do zero abandona aquele carrinho e abre outro.
   */
  AWAITING_CART_RESUME_DECISION: 'awaiting_cart_resume_decision',
  MAIN_MENU: 'main_menu',
  AWAITING_LIST: 'awaiting_list',
  BROWSING_CATEGORIES: 'browsing_categories',
  AWAITING_QUANTITY: 'awaiting_quantity',
  RESOLVING_ITEMS: 'resolving_items',
  CART_REVIEW: 'cart_review',
  EDITING_CART: 'editing_cart',
  AWAITING_DELIVERY_TYPE: 'awaiting_delivery_type',
  /** Pede o CEP ou a localização do WhatsApp. Texto livre sem CEP não serve para entrega (não dá para cotar). */
  AWAITING_ADDRESS: 'awaiting_address',
  /** CEP resolvido ou localização recebida — pede número (e complemento) para completar o endereço. */
  AWAITING_ADDRESS_NUMBER: 'awaiting_address_number',
  /** Cotação fora do raio ou indisponível: o cliente escolhe entre retirar na loja e outro endereço. */
  AWAITING_OUT_OF_RANGE_DECISION: 'awaiting_out_of_range_decision',
  /**
   * Cotação só pela cidade (D3): antes de cobrar a maior faixa em silêncio, o cliente confirma o
   * endereço — mandar a localização, trocar o endereço ou retirar na loja. O mesmo estado aceita a
   * mensagem de localização enquanto ela é esperada.
   */
  AWAITING_APPROXIMATE_ADDRESS_DECISION: 'awaiting_approximate_address_decision',
  AWAITING_PAYMENT: 'awaiting_payment',
  /** Só existe quando o pagamento é em dinheiro (roteiro §9): pergunta sim/não sobre troco. */
  AWAITING_CASH_CHANGE: 'awaiting_cash_change',
  /** Só depois de "Preciso de troco" — pede o valor com que o cliente vai pagar. */
  AWAITING_CASH_CHANGE_AMOUNT: 'awaiting_cash_change_amount',
  AWAITING_RECEIPT_PREFERENCE: 'awaiting_receipt_preference',
  AWAITING_EMAIL: 'awaiting_email',
  /**
   * O cliente já tem e-mail no cadastro: confirma o que está lá em vez de digitar de novo.
   *
   * Digitar e-mail no celular é a pergunta mais cara do fechamento, e era feita em toda compra mesmo
   * com o endereço já salvo — foi assim que um "sim" virou resposta à pergunta do e-mail.
   */
  AWAITING_EMAIL_CONFIRMATION: 'awaiting_email_confirmation',
  /**
   * "Quero mudar" abre a lista do que mudar, em vez de recomeçar o fechamento.
   *
   * Trocar só a forma de pagamento custava responder entrega, endereço, pagamento e recibo de novo:
   * o botão jogava o cliente na primeira pergunta do caminho longo e apagava a memória inteira.
   */
  AWAITING_CHECKOUT_CHANGE_CHOICE: 'awaiting_checkout_change_choice',
  /** Troca só o pagamento e volta ao resumo — o resto da memória fica de pé. */
  AWAITING_CHECKOUT_CHANGE_PAYMENT: 'awaiting_checkout_change_payment',
  /** Troca só a preferência de recibo e volta ao resumo. */
  AWAITING_CHECKOUT_CHANGE_RECEIPT: 'awaiting_checkout_change_receipt',
  /** E-mail pedido por uma troca de recibo dentro do "quero mudar": volta ao resumo, não ao caminho longo. */
  AWAITING_CHECKOUT_CHANGE_EMAIL: 'awaiting_checkout_change_email',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
} as const

export type ConversationState = (typeof CONVERSATION_STATE)[keyof typeof CONVERSATION_STATE]

export const SESSION_EXPIRY_MS = 6 * 60 * 60 * 1000
