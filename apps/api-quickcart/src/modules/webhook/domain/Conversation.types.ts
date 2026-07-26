/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Antes estes tipos eram o `$inferSelect` das tabelas locais, o que amarrava os handlers
 * de conversa ao formato físico da tabela. A persistência agora vive no schema
 * `meta_whatsapp` do @adatechnology/meta-whatsapp-module, que tem colunas a mais
 * (companyId, assignedUserId, humanRequestedAt) e nomes diferentes para as que importam.
 * Declarar o contrato aqui mantém a engine falando a linguagem do domínio e deixa o
 * mapeamento confinado ao repositório.
 */

export type ConversationSession = {
  readonly id: string
  readonly customerPhone: string
  readonly currentState: string
  readonly context: Record<string, unknown>
  readonly mode: string
  readonly lastInteractionAt: Date
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type Message = {
  readonly id: string
  readonly sessionId: string
  readonly direction: string
  readonly waMessageId: string | null
  readonly type: string
  readonly body: string | null
  readonly payload: unknown
  readonly status: string | null
  readonly createdAt: Date
  // Sem updatedAt: a tabela de mensagens do módulo não versiona a linha (uma mensagem é um
  // fato imutável). Mudança de entrega é registrada em `status` e, para lida, em readAt.
}
