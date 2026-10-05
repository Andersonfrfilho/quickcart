/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Apagar um cliente inteiro — ferramenta de teste, não operação de negócio.
 *
 * A porta é estreita de propósito: uma operação só, destrutiva, sem leitura e sem variação. Expor
 * isto como "repositório de cliente" com métodos de apagar ao lado dos de ler é convidar alguém a
 * chamar no fluxo normal, e é exatamente isso que não pode acontecer.
 */

export type ResetCustomerByPhoneResult = {
  /** Quanto foi apagado, por tabela. É o que a despedida do reset relata — e o que o teste afirma. */
  readonly deletedOrders: number
  readonly deletedCarts: number
  readonly deletedMessages: number
  readonly deletedSessions: number
  readonly deletedCustomers: number
}

export interface CustomerResetRepositoryInterface {
  /**
   * Apaga, numa transação só, tudo que o número carrega: pedidos, carrinhos, conversa e cadastro —
   * nos DOIS schemas de cliente, porque o legado em `public` e o do customer-module coexistem e
   * apagar só um deixa o bot cumprimentando pelo nome um cliente que ele diz não conhecer.
   *
   * Parcial seria pior que nada: um cadastro sem pedidos, ou uma conversa sem cadastro, é um estado
   * que o fluxo normal nunca produz — e depurar em cima dele é perseguir um bug que não existe.
   */
  resetByPhone(whatsAppNumber: string): Promise<ResetCustomerByPhoneResult>
}
