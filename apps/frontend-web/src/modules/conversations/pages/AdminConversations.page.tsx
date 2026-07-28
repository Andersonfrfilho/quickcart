/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Inbox de atendimento. Consome o SDK headless com a API e o SSE reais do QuickCart — os mesmos
 * contratos que o preview de atendente alimenta com mocks.
 */

import { useEffect, useMemo, useState } from 'react'
import '@adatechnology/conversations-ui/styles.css'
import {
  CHANNEL_FILTER_ALL,
  ChannelIcon,
  ConversationContextPanel,
  ConversationDocumentsPanel,
  ConversationHeader,
  ConversationRow,
  ConversationWallpaper,
  ConversationsProvider,
  DateDivider,
  isWindowBlocking,
  MessageBubble,
  MessageComposer,
  useConversationContext,
  useConversationMessages,
  useConversationRealtime,
  WINDOW_FILTERS,
  WindowExpiredNotice,
  windowOf,
  type ConversationSummary,
} from '@adatechnology/conversations-ui'

import { useRouter } from '@/app/router'
import { conversationsApi } from '@/modules/conversations/shared/conversationsApi'
import { conversationsSse } from '@/modules/conversations/shared/conversationsSse'
import { useAdminInbox, CONVERSATIONS_PER_PAGE } from '@/modules/conversations/hooks/useAdminInbox.hook'
import { toContextEntries } from '@/modules/conversations/shared/conversationContext'
import { downloadConversation } from '@/modules/conversations/shared/conversationsExport'

type ConversationPaneProps = {
  conversation: ConversationSummary
  now: number
  busy: boolean
  onTakeover: () => void
  onReturnToBot: () => void
  onBack: () => void
}

function ConversationPane({ conversation, now, busy, onTakeover, onReturnToBot, onBack }: ConversationPaneProps) {
  const { messages, refetch } = useConversationMessages(conversation.id)
  const { context } = useConversationContext(conversation.id)
  const [documentsOpen, setDocumentsOpen] = useState(false)

  // O evento traz só `{ direction, sender }` — quem tem o conteúdo é a query.
  useConversationRealtime(conversation.id, () => {
    void refetch()
  })

  const blocked = isWindowBlocking(windowOf({ lastInboundAt: conversation.lastInboundAt, now, channel: conversation.channel }))

  async function handleSend(text: string): Promise<void> {
    await conversationsApi.sendMessage(conversation.id, text)
    await refetch()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConversationHeader
        conversation={conversation}
        busy={busy}
        onTakeover={onTakeover}
        onReturnToBot={onReturnToBot}
        onDownload={() =>
          void downloadConversation({ conversationId: conversation.id, clientName: conversation.clientName })
        }
        onBack={onBack}
        onOpenDocuments={() => setDocumentsOpen(!documentsOpen)}
        documentsOpen={documentsOpen}
      />
      <ConversationContextPanel entries={toContextEntries(context)} />
      <ConversationDocumentsPanel conversationId={conversation.id} open={documentsOpen} />

      {/* Mesmo wallpaper do preview do cliente: o atendente e o cliente devem ver a conversa com a
          mesma aparência, senão o preview deixa de ser referência confiável. */}
      <ConversationWallpaper className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined
          const startsNewDay =
            !previous || new Date(message.timestamp).toDateString() !== new Date(previous.timestamp).toDateString()

          return (
            <div key={message.id}>
              {startsNewDay ? <DateDivider iso={message.timestamp} /> : null}
              <MessageBubble
                message={message}
                isMine={message.direction === 'outbound'}
                isFirstInGroup={!previous || previous.sender !== message.sender}
              />
            </div>
          )
        })}
      </ConversationWallpaper>

      {blocked ? (
        <WindowExpiredNotice disabled={busy} />
      ) : (
        <MessageComposer onSend={(text) => void handleSend(text)} placeholder="Responder como atendente…" />
      )}
    </div>
  )
}

function Inbox() {
  const inbox = useAdminInbox()
  const { searchParams } = useRouter()
  const now = useMemo(() => Date.now(), [inbox.pageConversations])

  const requestedConversationId = searchParams.get('number') ?? undefined
  const [openedFromLink, setOpenedFromLink] = useState<string | undefined>(undefined)

  // Só seleciona depois que a conversa aparece na lista: o hook limpa qualquer `selectedId` que não
  // esteja em `conversations`, e no primeiro render a lista ainda está vazia.
  useEffect(() => {
    if (!requestedConversationId || openedFromLink === requestedConversationId) return
    if (!inbox.conversations.some((conversation) => conversation.id === requestedConversationId)) return
    inbox.selectConversation(requestedConversationId)
    setOpenedFromLink(requestedConversationId)
  }, [requestedConversationId, openedFromLink, inbox])

  const selectedConversation = inbox.conversations.find((conversation) => conversation.id === inbox.selectedId)
  const firstOnPage = (inbox.page - 1) * CONVERSATIONS_PER_PAGE + 1
  const lastOnPage = Math.min(inbox.page * CONVERSATIONS_PER_PAGE, inbox.filteredCount)

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Cabeçalho denso em tela estreita: ícone + número. O rótulo escrito ("conversas",
          "não lidas") ocupava três linhas em 375px e empurrava a lista para fora da tela. */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold lg:text-xl">Conversas</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-gray-500">
            <span title="Conversas">
              💬 {inbox.totalCount}
              <span className="cv-only-wide"> conversas</span>
            </span>
            <span title="Aguardando atendimento" className="text-amber-600 dark:text-amber-400">
              ⏳ {inbox.waitingCount}
              <span className="cv-only-wide"> aguardando</span>
            </span>
            <span title="Não lidas">
              👥 {inbox.unreadCount}
              <span className="cv-only-wide"> não lidas</span>
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => inbox.setWaitingOnly(!inbox.waitingOnly)}
            aria-pressed={inbox.waitingOnly}
            title="Só aguardando atendimento"
            className={`rounded-md border px-3 py-2 text-sm ${inbox.waitingOnly ? 'bg-primary text-primary-foreground' : ''}`}
          >
            ⏳<span className="cv-only-wide"> Aguardando atendimento</span>
          </button>
          {/* O contador só aparece quando há seleção: " (0)" era texto morto ao lado do ícone e, em
              tela estreita, era a única coisa que impedia o cabeçalho de ser só ícones. */}
          <button
            type="button"
            onClick={() => void inbox.markSelectedAsRead()}
            disabled={inbox.selectedIds.size === 0 || inbox.busy}
            title="Marcar selecionadas como lidas"
            aria-label="Marcar selecionadas como lidas"
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            ✓<span className="cv-only-wide"> Marcar selecionadas como lidas</span>
            {inbox.selectedIds.size > 0 ? ` (${inbox.selectedIds.size})` : ''}
          </button>
        </div>
      </header>

      {/* Master/detail: em tela estreita a grade empilhava lista e painel dentro da mesma altura
          fixa, e cada um virava uma fatia inútil. Abaixo de `lg`, mostra um ou outro. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside
          className={`flex min-h-0 flex-col border-r ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}
        >
          <div className="space-y-2 border-b p-3">
            <input
              type="search"
              value={inbox.search}
              onChange={(event) => inbox.setSearch(event.target.value)}
              placeholder="Buscar conversa..."
              className="w-full rounded-md border px-3 py-2 text-sm"
            />

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Janela:</span>
              {WINDOW_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => inbox.setWindowFilter(filter.value)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 ${
                    inbox.windowFilter === filter.value ? 'bg-gray-200 dark:bg-gray-700' : ''
                  }`}
                >
                  {filter.dotClass ? <span className={`h-2 w-2 rounded-full ${filter.dotClass}`} /> : null}
                  {filter.label}
                </button>
              ))}
            </div>

            {/* A barra sai da própria listagem e some quando há um canal só — o SDK devolve lista
                vazia nesse caso, porque filtro de opção única não filtra nada. */}
            {inbox.channelFilters.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">Canal:</span>
                {inbox.channelFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => inbox.setChannelFilter(filter.value)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 ${
                      inbox.channelFilter === filter.value ? 'bg-gray-200 dark:bg-gray-700' : ''
                    }`}
                  >
                    {filter.value === CHANNEL_FILTER_ALL ? null : <ChannelIcon channel={filter.value} />}
                    {filter.label}
                  </button>
                ))}
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={inbox.pageConversations.length > 0 && inbox.pageConversations.every((c) => inbox.selectedIds.has(c.id))}
                onChange={inbox.toggleSelectAllOnPage}
              />
              Selecionar todas
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {inbox.pageConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === inbox.selectedId}
                selected={inbox.selectedIds.has(conversation.id)}
                now={now}
                busy={inbox.busy}
                onOpen={() => inbox.selectConversation(conversation.id)}
                onToggleSelected={() => inbox.toggleSelected(conversation.id)}
                onTakeover={() => void inbox.takeover(conversation.id)}
              />
            ))}
            {!inbox.loading && inbox.filteredCount === 0 ? (
              <p className="p-4 text-sm text-gray-500">Nenhuma conversa encontrada.</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
            <span className="text-gray-500">
              {inbox.filteredCount === 0 ? '0' : `${firstOnPage}–${lastOnPage}`} de {inbox.filteredCount}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => inbox.goToPage(1)} disabled={inbox.page === 1} className="px-2 disabled:opacity-40">
                «
              </button>
              <button
                type="button"
                onClick={() => inbox.goToPage(inbox.page - 1)}
                disabled={inbox.page === 1}
                className="px-2 disabled:opacity-40"
              >
                ‹
              </button>
              <span>
                {inbox.page} / {inbox.pageCount}
              </span>
              <button
                type="button"
                onClick={() => inbox.goToPage(inbox.page + 1)}
                disabled={inbox.page === inbox.pageCount}
                className="px-2 disabled:opacity-40"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => inbox.goToPage(inbox.pageCount)}
                disabled={inbox.page === inbox.pageCount}
                className="px-2 disabled:opacity-40"
              >
                »
              </button>
            </div>
          </div>
        </aside>

        {/* `section`, não `main`: o AdminLayout já provê o `main` da página. */}
        <section className={`min-h-0 ${selectedConversation ? 'flex flex-col' : 'hidden lg:block'}`}>
          {selectedConversation ? (
            <ConversationPane
              conversation={selectedConversation}
              now={now}
              busy={inbox.busy}
              onTakeover={() => void inbox.takeover(selectedConversation.id)}
              onReturnToBot={() => void inbox.releaseToBot(selectedConversation.id)}
              onBack={inbox.clearSelection}
            />
          ) : (
            <p className="p-6 text-sm text-gray-500">Selecione uma conversa.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export function AdminConversationsPage() {
  return (
    <ConversationsProvider api={conversationsApi} sse={conversationsSse}>
      <Inbox />
    </ConversationsProvider>
  )
}
