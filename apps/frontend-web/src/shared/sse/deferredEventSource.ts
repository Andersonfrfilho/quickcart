/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * EventSource que só existe depois do ticket.
 *
 * Os streams não aceitam header (o EventSource do navegador não manda nenhum), então a credencial é
 * um ticket emitido antes por rota autenticada — e pegar o ticket é assíncrono, enquanto quem assina
 * espera um objeto agora. A saída é um source que já aceita listeners e conecta em segundo plano:
 * ninguém espera, e o `close()` antes de o ticket chegar cancela a conexão em vez de deixar um
 * EventSource órfão.
 *
 * Nasceu na inbox e foi extraído quando a tela de separação passou a precisar do mesmo par
 * ticket/stream — duplicar significaria corrigir o vazamento do `close()` prematuro em dois lugares.
 */

export type TicketedEventSource = {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void
  close(): void
}

type PendingListener = {
  readonly type: string
  readonly listener: (event: MessageEvent) => void
}

export type CreateDeferredEventSourceParams = {
  /** Busca o ticket na rota autenticada. Rejeitar aqui apenas deixa a tela sem tempo real. */
  readonly issueTicket: () => Promise<string>
  readonly streamUrl: (ticket: string) => string
  /** Chamado quando o stream abre e quando cai — é o que a tela usa para decidir se ainda precisa de polling. */
  readonly onConnectionChange?: (isConnected: boolean) => void
}

export function createDeferredEventSource(params: CreateDeferredEventSourceParams): TicketedEventSource {
  const pending: PendingListener[] = []
  let connected: EventSource | undefined
  let closed = false

  void params
    .issueTicket()
    .then((ticket) => {
      if (closed) return

      const source = new EventSource(params.streamUrl(ticket))
      for (const entry of pending) source.addEventListener(entry.type, entry.listener)

      source.onopen = () => params.onConnectionChange?.(true)
      /*
       * `onerror` é queda, não fim: o EventSource reconecta sozinho, e o navegador dispara `onopen`
       * de novo quando volta. Avisar desconectado aqui é o que religa o polling de segurança durante
       * a janela em que o stream está mudo — sem isso, a tela ficaria parada acreditando no push.
       */
      source.onerror = () => params.onConnectionChange?.(false)

      connected = source
    })
    .catch(() => {
      // Sem ticket não há stream. Silenciar é deliberado: a tela continua correta pelo refetch, e
      // derrubá-la por falha de realtime seria pior que ficar sem tempo real.
      params.onConnectionChange?.(false)
    })

  return {
    addEventListener(type, listener) {
      if (connected) {
        connected.addEventListener(type, listener)
        return
      }
      pending.push({ type, listener })
    },

    removeEventListener(type, listener) {
      if (connected) {
        connected.removeEventListener(type, listener)
        return
      }
      const index = pending.findIndex((entry) => entry.type === type && entry.listener === listener)
      if (index >= 0) pending.splice(index, 1)
    },

    close() {
      closed = true
      connected?.close()
      pending.length = 0
      params.onConnectionChange?.(false)
    },
  }
}
