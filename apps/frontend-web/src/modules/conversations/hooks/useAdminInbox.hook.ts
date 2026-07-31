/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Estado da inbox: filtros, paginação, seleção em massa e ações de atendimento.
 *
 * A paginação é client-side porque a rota de listagem ignora `page`/`limit` e devolve a coleção
 * inteira. Fatiar aqui mantém a tela utilizável com centenas de conversas, mas não substitui
 * paginação de verdade no servidor — com dezenas de milhares, o gargalo volta.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CHANNEL_FILTER_ALL,
  DEFAULT_CONVERSATION_CHANNEL,
  CONVERSATION_WINDOW,
  useConversationList,
  useGlobalRealtime,
  windowOf,
  channelFiltersFor,
  type ChannelFilter,
  type ChannelFilterOption,
  type ConversationSummary,
  type ConversationWindow,
} from '@adatechnology/conversations-ui'

import { adminRequest } from '@/modules/admin/shared/adminRequest'
import { conversationsApi } from '@/modules/conversations/shared/conversationsApi'

export const CONVERSATIONS_PER_PAGE = 50

export type UseAdminInboxResult = {
  readonly conversations: ConversationSummary[]
  readonly pageConversations: ConversationSummary[]
  readonly loading: boolean
  readonly totalCount: number
  readonly unreadCount: number
  readonly waitingCount: number
  readonly filteredCount: number
  readonly page: number
  readonly pageCount: number
  readonly selectedId: string | undefined
  readonly selectedIds: ReadonlySet<string>
  readonly waitingOnly: boolean
  readonly windowFilter: ConversationWindow
  readonly channelFilter: ChannelFilter
  readonly channelFilters: ChannelFilterOption[]
  readonly search: string
  readonly busy: boolean
  /**
   * Por que a lista está vazia, quando não é por não haver conversa.
   *
   * O hook do SDK já devolvia `error` e este aqui descartava: sessão expirada virava "0 conversas",
   * indistinguível de inbox vazia de verdade. Quem olha conclui que os dados sumiram.
   */
  readonly loadFailure: string | undefined
  selectConversation(conversationId: string): void
  clearSelection(): void
  toggleSelected(conversationId: string): void
  toggleSelectAllOnPage(): void
  setWaitingOnly(value: boolean): void
  setWindowFilter(value: ConversationWindow): void
  setChannelFilter(value: ChannelFilter): void
  setSearch(value: string): void
  goToPage(value: number): void
  markSelectedAsRead(): Promise<void>
  takeover(conversationId: string): Promise<void>
  releaseToBot(conversationId: string): Promise<void>
}

function describeInboxFailure(error: unknown): string | undefined {
  if (!error) return undefined
  const status = (error as { status?: number }).status
  if (status === 401 || status === 403) {
    return 'Sessão expirada nesta aba — entre no painel de novo para ver as conversas.'
  }
  return error instanceof Error && error.message
    ? `Não foi possível carregar as conversas: ${error.message}`
    : 'Não foi possível carregar as conversas.'
}

export function useAdminInbox(): UseAdminInboxResult {
  const [waitingOnly, setWaitingOnly] = useState(false)
  const [windowFilter, setWindowFilter] = useState<ConversationWindow>(CONVERSATION_WINDOW.ALL)
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(CHANNEL_FILTER_ALL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const { conversations, loading, error, refetch } = useConversationList({
    ...(waitingOnly ? { waitingHuman: true } : {}),
    ...(search ? { search } : {}),
  })

  // `data-changed` é o único evento do canal global e vem sem payload: a resposta correta é
  // refazer a query, não tentar deduzir o que mudou.
  useGlobalRealtime(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  // Carimbo único por render de lista: recalcular `Date.now()` por linha faria conversas na
  // fronteira de 12h/21h/24h caírem em faixas diferentes na mesma tela.
  const now = useMemo(() => Date.now(), [conversations])

  const filtered = useMemo(
    () =>
      conversations
        .filter(
          (conversation) =>
            channelFilter === CHANNEL_FILTER_ALL ||
            (conversation.channel ?? DEFAULT_CONVERSATION_CHANNEL) === channelFilter,
        )
        .filter(
          (conversation) =>
            windowFilter === CONVERSATION_WINDOW.ALL ||
            windowOf({ lastInboundAt: conversation.lastInboundAt, now, channel: conversation.channel }) ===
              windowFilter,
        ),
    [conversations, windowFilter, channelFilter, now],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / CONVERSATIONS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const pageConversations = filtered.slice(
    (currentPage - 1) * CONVERSATIONS_PER_PAGE,
    currentPage * CONVERSATIONS_PER_PAGE,
  )

  // Trocar de filtro com a página 7 ativa deixaria a lista vazia sem explicação.
  useEffect(() => {
    setPage(1)
  }, [search, waitingOnly, windowFilter, channelFilter])

  useEffect(() => {
    if (selectedId && !conversations.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(undefined)
    }
  }, [conversations, selectedId])

  /**
   * Última tentativa de marcar como lida, como `id:unread`.
   *
   * Guarda contra laço quente: marcar dispara `refetch`, que muda `conversations`, que reexecuta o
   * efeito. O `unread === 0` já encerra o ciclo normal, mas se a rota falhar ou devolver dado velho o
   * par se repetiria para sempre — e uma requisição por render é o tipo de erro que só aparece em
   * produção, na aba que alguém deixou aberta.
   */
  const lastMarkReadAttempt = useRef<string | undefined>(undefined)

  /**
   * Conversa aberta não exibe contador de não lidas.
   *
   * Em efeito, e não dentro do clique, para cobrir os dois casos com a mesma regra: abrir a conversa
   * e receber mensagem nova enquanto ela está na tela. O atendente está lendo — deixar o badge subir
   * na linha que ele tem aberta na frente é ruído que ele não tem como resolver.
   */
  useEffect(() => {
    if (!selectedId) return

    const opened = conversations.find((conversation) => conversation.id === selectedId)
    // Reabrir conversa já lida não gasta requisição.
    if (!opened || opened.unread === 0) return

    const attempt = `${selectedId}:${opened.unread}`
    if (lastMarkReadAttempt.current === attempt) return
    lastMarkReadAttempt.current = attempt

    void conversationsApi
      .markRead(selectedId)
      .then(() => refetch())
      .catch(() => {
        // Sem tratamento visível de propósito: falhar aqui deixa o badge onde estava, que é
        // exatamente a verdade — nada foi marcado. Um alerta a mais competiria com o atendimento.
      })
  }, [selectedId, conversations, refetch])

  const toggleSelected = useCallback((conversationId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(conversationId)) next.delete(conversationId)
      else next.add(conversationId)
      return next
    })
  }, [])

  const pageIds = pageConversations.map((conversation) => conversation.id)
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  const toggleSelectAllOnPage = useCallback((): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }, [allOnPageSelected, pageIds])

  const markSelectedAsRead = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      // Uma chamada por conversa: não existe rota em lote. Em paralelo para não somar latência,
      // mas é o motivo de a ação agir sobre a seleção e não sobre as 302 de uma vez.
      await Promise.all([...selectedIds].map((conversationId) => conversationsApi.markRead(conversationId)))
      setSelectedIds(new Set())
      await refetch()
    } finally {
      setBusy(false)
    }
  }, [selectedIds, refetch])

  // Fora do contrato do SDK (`ConversationsApi` não tem takeover/release), então vão direto na rota.
  const runConversationAction = useCallback(
    async (conversationId: string, action: 'takeover' | 'release'): Promise<void> => {
      setBusy(true)
      try {
        await adminRequest<void>(`/conversations/${encodeURIComponent(conversationId)}/${action}`, { method: 'POST' })
        await refetch()
      } finally {
        setBusy(false)
      }
    },
    [refetch],
  )

  const takeover = useCallback(
    (conversationId: string) => runConversationAction(conversationId, 'takeover'),
    [runConversationAction],
  )

  const releaseToBot = useCallback(
    (conversationId: string) => runConversationAction(conversationId, 'release'),
    [runConversationAction],
  )

  return {
    conversations,
    pageConversations,
    loading,
    totalCount: conversations.length,
    unreadCount: conversations.reduce((total, conversation) => total + conversation.unread, 0),
    waitingCount: conversations.filter((conversation) => conversation.waitingHuman).length,
    filteredCount: filtered.length,
    page: currentPage,
    pageCount,
    selectedId,
    selectedIds,
    waitingOnly,
    windowFilter,
    channelFilter,
    channelFilters: channelFiltersFor(conversations),
    search,
    busy,
    loadFailure: describeInboxFailure(error),
    selectConversation: setSelectedId,
    clearSelection: () => setSelectedId(undefined),
    toggleSelected,
    toggleSelectAllOnPage,
    setWaitingOnly,
    setWindowFilter,
    setChannelFilter,
    setSearch,
    goToPage: setPage,
    markSelectedAsRead,
    takeover,
    releaseToBot,
  }
}
