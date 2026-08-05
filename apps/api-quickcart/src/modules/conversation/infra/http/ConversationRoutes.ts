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
import type { createPreviewTranscriptController } from './PreviewTranscript.controller'
import type { createPreviewMediaController } from './PreviewMedia.controller'
import type { createPreviewInboundController } from './PreviewInbound.controller'
import type { UnmatchedDemandController } from './UnmatchedDemand.controller'

type PreviewTranscriptController = ReturnType<typeof createPreviewTranscriptController>
type PreviewMediaController = ReturnType<typeof createPreviewMediaController>
type PreviewInboundController = ReturnType<typeof createPreviewInboundController>

type RegisterConversationRoutesParams = {
  readonly router: Router
  readonly conversationController: ConversationController
  readonly settingsController: ConversationSettingsController
  readonly streamController: ConversationStreamController
  readonly previewTranscriptController: PreviewTranscriptController
  readonly previewMediaController: PreviewMediaController
  readonly previewInboundController: PreviewInboundController
  readonly unmatchedDemandController: UnmatchedDemandController
}

export function registerConversationRoutes(params: RegisterConversationRoutesParams): void {
  const { router, conversationController, settingsController, streamController, previewTranscriptController } = params
  const { previewMediaController, previewInboundController, unmatchedDemandController } = params

  // Demanda que a loja está perdendo. Fica em /admin porque é leitura sobre comportamento de cliente,
  // e agregada ela ainda diz quantas pessoas pediram cada item.
  router.get('/v1/admin/demands/unmatched', unmatchedDemandController.handleListAdmin)

  // Antes das rotas com `:number`: "preview" casaria com o parâmetro dinâmico. Ao contrário das
  // outras rotas de preview, esta é do painel e exige token de admin — forjar um inbound é escrever
  // no transcript de um cliente.
  router.post('/v1/admin/conversations/preview/inbound', previewInboundController.handleSend)

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
  // Fora de /conversations e endereçada por messageId: transcrição é por áudio, e uma conversa tem
  // vários. Responde 404 quando a transcrição não está habilitada.
  router.post('/v1/admin/messages/:messageId/transcription', conversationController.handleTranscribeAudio)
  // Ambas fora de /conversations: a biblioteca é da empresa e a URL assinada é endereçada pelo
  // objeto, não pela conversa.
  router.get('/v1/admin/documents', conversationController.handleListAllDocuments)
  router.get('/v1/admin/documents/:uploadId/url', conversationController.handleGetDocumentUrl)

  // Fora de /v1/admin de propósito: a aba do preview do cliente não tem sessão. Quem autoriza é a
  // flag de servidor `PREVIEW_TRANSCRIPT_ENABLED` — ver PreviewTranscript.controller. Todas
  // respondem 404 quando ela está desligada, que é o padrão em staging e produção.
  router.get('/v1/preview/conversations/:number/messages', previewTranscriptController.handleListMessages)
  // Guarda o áudio gravado no simulador. 404 quando o recurso está desligado — ver o controller.
  router.post('/v1/preview/media', previewMediaController.handleUpload)
  // Entrega o inbound da aba do cliente. A assinatura do webhook é gerada no servidor: é o que tirou
  // o app secret do bundle do frontend.
  router.post('/v1/preview/inbound', previewInboundController.handleSendFromPreview)

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
