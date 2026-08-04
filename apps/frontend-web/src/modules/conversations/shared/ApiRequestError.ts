/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Erro de requisição que preserva o status HTTP e o código da API.
 *
 * `new Error(mensagem)` obrigava quem trata a adivinhar o motivo pelo texto, e o custo disso apareceu
 * no simulador do cliente: ele tratava QUALQUER falha ao ler o transcript como "conversa ainda não
 * existe" e mostrava thread vazia — então um 401 por sessão ausente virava silêncio absoluto, com o
 * operador achando que o envio não funcionou.
 */

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}
