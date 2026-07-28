/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Todas sob /v1/admin: são telas de operação do lojista, não do cliente final. A exceção são os
 * streams, que carregam ticket próprio na query porque o EventSource não manda header.
 */

import type { Router } from '@/infra/http/router'
import type { ConversationController } from './Conversation.controller'
import type { ConversationSettingsController } from './ConversationSettings.controller'
import type { ConversationStreamController } from './ConversationStream.controller'

type RegisterConversationRoutesParams = {
  readonly router: Router
  readonly conversationController: ConversationController
  readonly settingsController: ConversationSettingsController
  readonly streamController: ConversationStreamController
}

export function registerConversationRoutes(params: RegisterConversationRoutesParams): void {
  const { router, conversationController, settingsController, streamController } = params

  router.get('/v1/admin/conversations', conversationController.handleList)
  router.get('/v1/admin/conversations/:number/messages', conversationController.handleListMessages)
  router.get('/v1/admin/conversations/:number/context', conversationController.handleGetContext)
  router.get('/v1/admin/conversations/:number/documents', conversationController.handleListDocuments)
  // POST porque a seleção vai no corpo: uma lista de ids não cabe em query string com folga.
  router.post('/v1/admin/conversations/:number/documents/archive', conversationController.handleDownloadDocumentsArchive)
  // Destrutivo e sem lixeira: apaga a conversa, as mensagens e a mídia no storage.
  router.delete('/v1/admin/conversations/:number', conversationController.handleDeleteConversation)
  router.get('/v1/admin/conversations/:number/export', conversationController.handleExport)
  router.post('/v1/admin/conversations/:number/messages', conversationController.handleSendText)
  router.post('/v1/admin/conversations/:number/media', conversationController.handleSendMedia)
  router.post('/v1/admin/conversations/:number/template', conversationController.handleSendTemplate)
  router.post('/v1/admin/conversations/:number/read', conversationController.handleMarkRead)
  router.post('/v1/admin/conversations/:number/takeover', conversationController.handleTakeover)
  router.post('/v1/admin/conversations/:number/release', conversationController.handleRelease)
  router.get('/v1/admin/whatsapp/media/:mediaId', conversationController.handleMediaProxy)
  // Ambas fora de /conversations: a biblioteca é da empresa e a URL assinada é endereçada pelo
  // objeto, não pela conversa.
  router.get('/v1/admin/documents', conversationController.handleListAllDocuments)
  router.get('/v1/admin/documents/:uploadId/url', conversationController.handleGetDocumentUrl)

  router.get('/v1/admin/whatsapp/settings', settingsController.handleGetSettings)
  router.put('/v1/admin/whatsapp/settings', settingsController.handleSaveSettings)

  router.get('/v1/admin/flows', settingsController.handleListFlows)
  router.post('/v1/admin/flows', settingsController.handleCreateFlow)
  router.get('/v1/admin/flows/live-positions', settingsController.handleLiveFlowPositions)
  router.get('/v1/admin/flows/:key', settingsController.handleGetFlow)
  router.put('/v1/admin/flows/:key', settingsController.handleSaveFlow)
  router.delete('/v1/admin/flows/:key', settingsController.handleDeleteFlow)

  router.post('/v1/admin/conversations/stream-ticket', streamController.handleIssueTicket)
  router.get('/v1/admin/conversations/stream', streamController.handleGlobalStream)
  router.get('/v1/admin/conversations/:number/stream', streamController.handleConversationStream)
}
