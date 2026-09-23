/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Stream SSE de um pedido: o que faz a tela de separação saber que o cliente respondeu sobre o item
 * em falta sem ninguém recarregar nada.
 *
 * Mesma dupla ticket/stream da inbox, e pela mesma razão: o EventSource do navegador não manda header
 * Authorization, então a credencial é um ticket de uso único emitido antes por rota autenticada. Um
 * token de operador na query string ficaria gravado em log de proxy e no histórico do tablet.
 */

import { issueSseTicket, redeemSseTicket, type SseHub, type TicketStoreInterface } from '@adatechnology/meta-whatsapp-module'
import type { RouteHandler } from '@/infra/http/router'
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { ORDER_READERS } from '@/modules/user/shared/User.constant'
import { ORDERS_CHANNEL, orderChannel } from '@/modules/order/shared/Order.constant'
import { UnauthorizedError } from '@/shared/errors/AppError.error'
import { UNAUTHORIZED } from '@/shared/errors/codes'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'

const streamLog = logger.child('OrderStream')

// Proxies e balanceadores derrubam conexão ociosa; um comentário SSE mantém o socket vivo sem virar
// evento na UI. Mesmo intervalo do stream da inbox — é a mesma infra na frente.
const HEARTBEAT_INTERVAL_MS = 25_000

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

type OrderStreamControllerDependencies = {
  readonly sseHub: SseHub
  readonly ticketStore: TicketStoreInterface
}

export class OrderStreamController {
  constructor(private readonly dependencies: OrderStreamControllerDependencies) {}

  /** O ticket nasce amarrado ao pedido: quem pede um para o pedido A não abre o stream do pedido B. */
  handleIssueTicket: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ORDER_READERS })

    /*
     * Sem `order` na query, o ticket é o da lista. Um ticket só serve a um canal: quem pediu para a lista
     * não abre o stream de um pedido, e vice-versa — é o mesmo escopo gravado que o resgate confere.
     */
    const orderId = request.query.get('order')
    const channel = orderId ? orderChannel(orderId) : ORDERS_CHANNEL

    const ticket = await issueSseTicket(this.dependencies.ticketStore, COMPANY_ID, channel)
    response.json(201, { data: { ticket } })
  }

  /** Stream da lista: tudo que muda em qualquer pedido, mais os que acabam de entrar. */
  handleOrdersStream: RouteHandler = async (request, response) => {
    await this.openStream(request, response, ORDERS_CHANNEL)
  }

  handleOrderStream: RouteHandler = async (request, response) => {
    const orderId = request.params[0]
    if (!orderId) throw new UnauthorizedError('Pedido não informado', UNAUTHORIZED)

    await this.openStream(request, response, orderChannel(orderId))
  }

  private async openStream(
    request: { readonly query: URLSearchParams },
    response: { stream: (params: { contentType: string; onOpen: (writer: { write(chunk: string): void; close(): void }) => void; onClose: () => void }) => void },
    channel: string,
  ): Promise<void> {
    const ticket = request.query.get('ticket')
    const redeemed = ticket ? await redeemSseTicket(this.dependencies.ticketStore, ticket) : null
    if (!redeemed) throw new UnauthorizedError('Ticket de stream inválido ou já usado', UNAUTHORIZED)
    if (redeemed.companyId !== COMPANY_ID || redeemed.whatsappNumber !== channel) {
      throw new UnauthorizedError('Ticket não autoriza este stream', UNAUTHORIZED)
    }

    let unsubscribe: (() => void) | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined

    response.stream({
      contentType: 'text/event-stream',
      onOpen: async (writer) => {
        // Alguns proxies só liberam o corpo depois do primeiro byte.
        writer.write(': stream aberto\n\n')

        // A inscrição precisa acontecer antes do primeiro keep-alive: evento emitido entre abrir e
        // inscrever se perderia sem deixar rastro, e é justamente a resposta do cliente que se perderia.
        unsubscribe = await this.dependencies.sseHub.subscribe(channel, (event, payload) => {
          writer.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
        })

        heartbeat = setInterval(() => writer.write(': keep-alive\n\n'), HEARTBEAT_INTERVAL_MS)
      },
      onClose: () => {
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe?.()
        streamLog.info('stream_closed', { channel })
      },
    })
  }
}
