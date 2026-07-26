/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Stream SSE da inbox. O EventSource do navegador não manda header Authorization, então a
 * autenticação é por ticket: a UI pede um ticket numa rota autenticada normalmente e o gasta
 * na query string do stream. O ticket é de uso único e vida curta — um token de admin na URL
 * ficaria gravado em log de proxy e histórico.
 */

import { issueSseTicket, redeemSseTicket, type SseHub, type TicketStoreInterface } from '@adatechnology/meta-whatsapp-module'
import type { RouteHandler } from '@/infra/http/router'
import { requireAdminToken } from '@/infra/http/middlewares/requireAdminToken'
import { UnauthorizedError } from '@/shared/errors/AppError.error'
import { UNAUTHORIZED } from '@/shared/errors/codes'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'

const streamLog = logger.child('ConversationStream')

// Intervalo do comentário de keep-alive. Proxies e balanceadores derrubam conexão ociosa;
// um comentário SSE (linha iniciada por ':') mantém o socket vivo sem virar evento na UI.
const HEARTBEAT_INTERVAL_MS = 25_000

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

// Escopo sentinela para o stream que não é de uma conversa específica. Não é um número de
// WhatsApp válido, então não colide com nenhum escopo real.
const GLOBAL_STREAM_SCOPE = '*'

// Nome do canal global no módulo (ver LogMessage/Takeover/Release use-cases). Não é escolha
// nossa: tem de casar exatamente com o que o SseHub recebe no emit.
const GLOBAL_CHANNEL = 'global'

type ConversationStreamControllerDependencies = {
  readonly sseHub: SseHub
  readonly ticketStore: TicketStoreInterface
}

export class ConversationStreamController {
  constructor(private readonly dependencies: ConversationStreamControllerDependencies) {}

  // O ticket é emitido já amarrado ao canal que ele autoriza: quem pede um ticket para uma
  // conversa não consegue gastá-lo no stream global, nem no de outro número.
  handleIssueTicket: RouteHandler = async (request, response) => {
    // Esta é a rota autenticada da dupla: quem consegue um ticket já provou ser admin. Os
    // streams em si não podem exigir header, então o ticket é a credencial deles.
    requireAdminToken(request)

    const whatsappNumber = request.query.get('conversation') ?? GLOBAL_STREAM_SCOPE
    const ticket = await issueSseTicket(this.dependencies.ticketStore, COMPANY_ID, whatsappNumber)
    response.json(201, { data: { ticket } })
  }

  // Stream global: tudo que muda em qualquer conversa. É o que faz a lista da inbox reordenar
  // e o contador de não lidas subir sem o atendente recarregar.
  handleGlobalStream: RouteHandler = async (request, response) => {
    await this.openStream(request, response, GLOBAL_STREAM_SCOPE, GLOBAL_CHANNEL)
  }

  handleConversationStream: RouteHandler = async (request, response) => {
    const whatsappNumber = request.params[0]
    if (!whatsappNumber) throw new UnauthorizedError('Conversa não informada', UNAUTHORIZED)
    await this.openStream(request, response, whatsappNumber, `conv:${whatsappNumber}`)
  }

  private async openStream(
    request: { readonly query: URLSearchParams },
    response: { stream: (params: { contentType: string; onOpen: (writer: { write(chunk: string): void; close(): void }) => void; onClose: () => void }) => void },
    expectedScope: string,
    channel: string,
  ): Promise<void> {
    const ticket = request.query.get('ticket')
    const redeemed = ticket ? await redeemSseTicket(this.dependencies.ticketStore, ticket) : null
    if (!redeemed) throw new UnauthorizedError('Ticket de stream inválido ou já usado', UNAUTHORIZED)
    // Confere o escopo gravado no ticket: sem isto, um ticket de uma conversa abriria o stream
    // global e o atendente veria mensagens de clientes que não são dele.
    if (redeemed.companyId !== COMPANY_ID || redeemed.whatsappNumber !== expectedScope) {
      throw new UnauthorizedError('Ticket não autoriza este stream', UNAUTHORIZED)
    }

    // A inscrição é assíncrona e precisa acontecer ANTES de responder, senão eventos emitidos
    // entre a resposta e a inscrição se perdem sem deixar rastro.
    let unsubscribe: (() => void) | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined

    response.stream({
      contentType: 'text/event-stream',
      onOpen: async (writer) => {
        // Evento de abertura: alguns proxies só liberam o corpo depois do primeiro byte.
        writer.write(': stream aberto\n\n')

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
