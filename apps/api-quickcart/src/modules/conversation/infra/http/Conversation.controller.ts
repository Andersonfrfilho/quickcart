/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cola HTTP sobre os use-cases do @adatechnology/meta-whatsapp-module para atender o contrato
 * ConversationsApi do @adatechnology/conversations-ui. Nenhuma regra de conversa vive aqui: o
 * controller traduz request/response e nada mais.
 *
 * O identificador de conversa na URL é o número de WhatsApp, que é como o módulo indexa
 * (companyId + whatsappNumber). Usar o id da sessão obrigaria um lookup extra em toda rota.
 */

import JSZip from 'jszip'
import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import type { MessageRow } from '@adatechnology/meta-whatsapp-module'
import type { ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import type { ObjectStorageProvider } from '@adatechnology/object-storage-provider'
import type { RouteHandler } from '@/infra/http/router'
import { requireAdminToken } from '@/infra/http/middlewares/requireAdminToken'
import { environment } from '@/infra/config/environment'
import { ValidationError, NotFoundError, TooManyRequestsError } from '@/shared/errors/AppError.error'
import { CONVERSATION_NOT_FOUND, CONVERSATION_DELETE_INCOMPLETE, VALIDATION_ERROR } from '@/shared/errors/codes'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

// Teto para não deixar o cliente pedir a coleção inteira numa requisição (padrão de APIs §Paginação).
const DEFAULT_CONVERSATIONS_PER_PAGE = 50
const MAX_CONVERSATIONS_PER_PAGE = 100
// Teto de itens considerados ao montar o zip — par do teto de bytes.
const MAX_ARCHIVE_FILES = 200

/**
 * Quantos zips podem ser montados AO MESMO TEMPO no processo.
 *
 * Medido: uma seleção de 40 MB levou o RSS de 43 MB para 325 MB — cerca de 7× o tamanho dos
 * arquivos, porque o binário existe três vezes ao mesmo tempo (buffer lido do storage, cópia
 * retida pelo jszip e a saída comprimida). O teto de bytes sozinho não protege nada se dez
 * requisições entrarem juntas: o que derruba o processo é a soma, não a maior.
 *
 * Com 1, o pico fica limitado a uma multiplicação; as demais recebem 429 e tentam de novo.
 */
const MAX_CONCURRENT_ARCHIVES = 1
let archiveInFlight = 0
const DEFAULT_DOCUMENTS_PER_PAGE = 10
const MAX_DOCUMENTS_PER_PAGE = 50
const DEFAULT_MESSAGE_LIMIT = 50
const MAX_MESSAGE_LIMIT = 100

type ConversationControllerDependencies = {
  readonly metaWhatsApp: MetaWhatsAppModule
  // Ausente quando STORAGE_ENABLED é falso: a listagem continua respondendo (é só consulta), e só
  // o download fica indisponível.
  readonly objectStorage?: ObjectStorageInterface
  // O provider cru, além do contrato do módulo: montar zip exige LER os bytes, e
  // `ObjectStorageInterface` só sabe subir e assinar URL.
  readonly objectStorageProvider?: ObjectStorageProvider
}

// As cinco espécies de mídia da Meta, na ordem em que o payload as traz.
const MEDIA_PAYLOAD_KEYS = ['image', 'video', 'audio', 'document', 'sticker'] as const

/**
 * Sobe para o topo da mensagem o que a UI precisa para desenhar mídia.
 *
 * O payload cru guarda isso em dois lugares — o objeto da Meta (`{ image: { id, mime_type } }`) e o
 * que a ingestão acrescenta (`uploadId`, `mimeType`) — e a bolha do SDK lê campos de topo. Sem esta
 * tradução, TODA mensagem de mídia chegava sem referência: foto virava "Mídia indisponível" e
 * arquivo virava "Documento / FILE", sem nome e sem tipo. Não aparecia antes porque a inbox real não
 * tinha mídia nenhuma para mostrar.
 */
function mediaFieldsOf(payload: unknown): Record<string, string | number> {
  if (!payload || typeof payload !== 'object') return {}
  const source = payload as Record<string, unknown>
  const kind = MEDIA_PAYLOAD_KEYS.find((key) => typeof source[key] === 'object' && source[key] !== null)
  const media = (kind ? source[kind] : undefined) as Record<string, unknown> | undefined

  const fields: Record<string, string | number> = {}
  const uploadId = source['uploadId']
  const mediaId = source['sourceMediaId'] ?? media?.['id']
  const mimeType = source['mimeType'] ?? media?.['mime_type']
  const filename = source['filename'] ?? media?.['filename']

  if (typeof uploadId === 'string') fields['uploadId'] = uploadId
  if (typeof mediaId === 'string') fields['mediaId'] = mediaId
  if (typeof mimeType === 'string') fields['mimeType'] = mimeType
  if (typeof filename === 'string') fields['filename'] = filename
  const sizeBytes = source['sizeBytes']
  if (typeof sizeBytes === 'number') fields['sizeBytes'] = sizeBytes
  return fields
}

// O conversations-ui espera `content`/`sentAt`; a linha do módulo usa `content`/`createdAt`.
export function toMessagePayload(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.whatsappNumber,
    direction: row.direction,
    sender: row.sender,
    type: row.type,
    content: row.content,
    payload: row.payload,
    waMessageId: row.waMessageId,
    status: row.status,
    sentAt: row.createdAt.toISOString(),
    ...mediaFieldsOf(row.payload),
    readAt: row.readAt?.toISOString() ?? null,
    // `null` preserva o "não avaliado" da coluna: a inbox não deve mostrar mensagem antiga, de
    // antes da moderação existir, como se tivesse passado por verificação.
    moderation:
      row.moderationFlagged === null
        ? null
        : { isOffensive: row.moderationFlagged, terms: row.moderationTerms ?? [] },
  }
}

/**
 * Traduz o apelido de origem que a UI manda para as origens reais gravadas na coluna.
 *
 * "Equipe" agrupa `agent` e `bot` porque, para quem procura um comprovante, o que importa é se o
 * arquivo veio do cliente ou saiu da loja — não se foi a pessoa ou o robô que enviou. O módulo não
 * conhece esse apelido de propósito: é vocabulário de tela e muda por produto.
 */
function resolveSourceFilter(source: string | null): { sources?: readonly string[] } {
  if (source === 'team') return { sources: ['agent', 'bot'] }
  if (source === 'customer') return { sources: ['customer'] }
  // 'all', ausente ou desconhecido: sem filtro, em vez de devolver lista vazia.
  return {}
}

/** Evita que dois arquivos de mesmo nome se sobrescrevam dentro do zip. */
function uniqueEntryName(archive: JSZip, filename: string): string {
  if (!archive.file(filename)) return filename
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  const extension = dot > 0 ? filename.slice(dot) : ''
  let index = 2
  while (archive.file(`${base} (${index})${extension}`)) index++
  return `${base} (${index})${extension}`
}

function requireNumber(request: { readonly params: readonly string[] }): string {
  const whatsappNumber = request.params[0]
  if (!whatsappNumber) throw new ValidationError('Número de WhatsApp ausente na rota', VALIDATION_ERROR)
  return whatsappNumber
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_MESSAGE_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_MESSAGE_LIMIT
  return Math.min(parsed, MAX_MESSAGE_LIMIT)
}

export class ConversationController {
  constructor(private readonly dependencies: ConversationControllerDependencies) {}

  handleList: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const search = request.query.get('search')
    const waitingHuman = request.query.get('waitingHuman')

    // O módulo já pagina (`limit`/`page` com offset); estes params vinham sendo descartados aqui, e
    // por isso a inbox nunca via além do limite padrão de 20, por mais conversas que existissem.
    const page = Number(request.query.get('page') ?? 1)
    const limit = Math.min(Number(request.query.get('limit') ?? DEFAULT_CONVERSATIONS_PER_PAGE), MAX_CONVERSATIONS_PER_PAGE)

    const conversations = await this.dependencies.metaWhatsApp.conversations.list.execute({
      companyId: COMPANY_ID,
      filters: {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CONVERSATIONS_PER_PAGE,
        ...(search ? { search } : {}),
        ...(waitingHuman === 'true' ? { waitingHuman: true } : {}),
      },
    })

    response.json(200, { data: conversations })
  }

  handleListMessages: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const before = request.query.get('before')

    const messages = await this.dependencies.metaWhatsApp.conversations.listMessages.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      limit: parseLimit(request.query.get('limit')),
      ...(before ? { before } : {}),
    })

    response.json(200, { data: messages.map(toMessagePayload) })
  }

  /** Biblioteca da empresa inteira — a tela de Documentos do painel, fora da conversa. */
  handleListAllDocuments: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const search = request.query.get('search')
    const page = Number(request.query.get('page') ?? 1)
    const limit = Math.min(
      Number(request.query.get('limit') ?? DEFAULT_DOCUMENTS_PER_PAGE),
      MAX_DOCUMENTS_PER_PAGE,
    )

    const result = await this.dependencies.metaWhatsApp.conversations.listCompanyDocuments.execute({
      companyId: COMPANY_ID,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DOCUMENTS_PER_PAGE,
      ...(search ? { search } : {}),
      ...resolveSourceFilter(request.query.get('source')),
      sortDirection: request.query.get('sortDirection') === 'asc' ? 'asc' : 'desc',
    })

    response.json(200, { data: result })
  }

  handleListDocuments: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const search = request.query.get('search')
    const page = Number(request.query.get('page') ?? 1)
    const limit = Math.min(
      Number(request.query.get('limit') ?? DEFAULT_DOCUMENTS_PER_PAGE),
      MAX_DOCUMENTS_PER_PAGE,
    )

    const result = await this.dependencies.metaWhatsApp.conversations.listDocuments.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DOCUMENTS_PER_PAGE,
      ...(search ? { search } : {}),
      ...resolveSourceFilter(request.query.get('source')),
      // Qualquer coisa diferente de 'asc' é 'desc': ordem padrão é mais recente primeiro, e valor
      // inválido na query não deve virar erro numa listagem.
      sortDirection: request.query.get('sortDirection') === 'asc' ? 'asc' : 'desc',
    })

    response.json(200, { data: result })
  }

  // A URL é assinada e curta (STORAGE_DOWNLOAD_URL_TTL_SECONDS): o binário nunca passa por aqui, o
  // atendente vai direto ao storage. Sem storage configurado a rota é 404 em vez de 500 — a
  // instalação simplesmente não tem biblioteca.
  handleGetDocumentUrl: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const uploadId = request.params[0]
    if (!uploadId) throw new ValidationError('Identificador do documento ausente', VALIDATION_ERROR)

    const storage = this.dependencies.objectStorage
    if (!storage) throw new NotFoundError('Biblioteca de documentos indisponível', CONVERSATION_NOT_FOUND)

    const key = decodeURIComponent(uploadId)
    const disposition = request.query.get('disposition') === 'attachment' ? 'attachment' : 'inline'

    // O nome sai da tabela, não da key: a key é o caminho no bucket (`meta-whatsapp/…/<mediaId>`) e
    // salvaria o arquivo com o id da Meta em vez de "nota-fiscal.pdf".
    const document = await this.dependencies.metaWhatsApp.conversations.documentRepository.findByUploadId(
      COMPANY_ID,
      key,
    )

    const url = await storage.getDownloadUrl(key, {
      disposition,
      ...(document?.filename ? { filename: document.filename } : {}),
    })

    response.json(200, { data: { url } })
  }

  /**
   * Baixa vários arquivos da conversa num único zip.
   *
   * O binário passa pela API desta vez — diferente do download unitário, que devolve URL assinada e
   * manda o atendente direto ao storage. Não há como assinar "um zip que ainda não existe", então
   * alguém precisa ler os objetos e montar o pacote.
   *
   * Por isso o teto: sem ele, selecionar a conversa inteira carregaria tudo na memória da API.
   */
  handleDownloadDocumentsArchive: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const whatsappNumber = requireNumber(request)
    const body = request.body as { uploadIds?: unknown }

    if (!Array.isArray(body?.uploadIds) || body.uploadIds.length === 0) {
      throw new ValidationError('Campo `uploadIds` é obrigatório e não pode ser vazio', VALIDATION_ERROR)
    }

    if (body.uploadIds.length > MAX_ARCHIVE_FILES) {
      throw new ValidationError(
        `Seleção tem ${body.uploadIds.length} arquivos e excede o limite de ${MAX_ARCHIVE_FILES}`,
        VALIDATION_ERROR,
      )
    }

    const storage = this.dependencies.objectStorageProvider
    if (!storage) throw new NotFoundError('Biblioteca de documentos indisponível', CONVERSATION_NOT_FOUND)

    // Recusa rápido em vez de enfileirar: segurar a requisição aberta consumiria a mesma memória
    // que se está tentando poupar, e o atendente prefere "tente de novo" a um timeout mudo.
    if (archiveInFlight >= MAX_CONCURRENT_ARCHIVES) {
      throw new TooManyRequestsError('Já há um arquivo compactado sendo montado; tente em instantes', 5)
    }
    archiveInFlight++

    // O `try` começa aqui, colado no incremento: qualquer saída depois deste ponto — inclusive as
    // validações abaixo, que lançam — precisa devolver a vaga. Ter o try só em volta da montagem
    // deixava o contador presto no primeiro 422 e a rota recusava tudo dali em diante.
    try {
    // Confere que cada id pertence A ESTA conversa antes de ler o bucket. Sem isso a rota viraria
    // um leitor de objeto arbitrário: quem tem token de admin passaria qualquer key e baixaria
    // arquivo de outra conversa.
    const allowed = await this.dependencies.metaWhatsApp.conversations.listDocuments.execute({
      companyId: COMPANY_ID,
      whatsappNumber,
      limit: MAX_ARCHIVE_FILES,
    })
    const byUploadId = new Map(allowed.documents.map((document) => [document.id, document]))
    const requested = body.uploadIds.filter((id): id is string => typeof id === 'string')
    const selected = requested.map((id) => byUploadId.get(id)).filter((doc) => doc !== undefined)

    if (selected.length === 0) {
      throw new NotFoundError('Nenhum documento válido para esta conversa', CONVERSATION_NOT_FOUND)
    }

    const totalBytes = selected.reduce((sum, document) => sum + document.sizeBytes, 0)
    if (totalBytes > environment.DOCUMENTS_ARCHIVE_MAX_BYTES) {
      throw new ValidationError(
        `Seleção soma ${totalBytes} bytes e excede o limite de ${environment.DOCUMENTS_ARCHIVE_MAX_BYTES}`,
        VALIDATION_ERROR,
      )
    }

    const archive = new JSZip()
    for (const document of selected) {
      const stream = await storage.get({ bucket: environment.STORAGE_BUCKET, key: document.id })
      // Nomes repetidos ganham sufixo: dois "nota.pdf" no mesmo zip fariam um sobrescrever o outro.
      archive.file(uniqueEntryName(archive, document.filename), await new Response(stream).arrayBuffer())
    }

    const zipped = await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

    response.binary(200, zipped, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`conversa-${whatsappNumber}.zip`)}`,
    })
    } finally {
      // `finally`, não depois do sucesso: erro no meio da montagem deixaria o contador preso e a
      // rota recusaria tudo para sempre.
      archiveInFlight--
    }
  }

  /**
   * Apaga a conversa e a mídia dela. Irreversível: não há lixeira, e a cascata leva mensagens e
   * documentos junto.
   *
   * `409` quando algum objeto falhou no storage — a conversa fica intacta de propósito, para a
   * operação poder repetir. Responder `204` nesse caso esconderia arquivo pago e sem ponteiro.
   */
  handleDeleteConversation: RouteHandler = async (request, response) => {
    requireAdminToken(request)

    const result = await this.dependencies.metaWhatsApp.conversations.delete.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
    })

    if (result.failedObjects.length > 0) {
      response.json(409, {
        error: {
          code: CONVERSATION_DELETE_INCOMPLETE,
          message: `Falha ao apagar ${result.failedObjects.length} arquivo(s) no storage; a conversa foi preservada`,
        },
      })
      return
    }

    response.json(200, { data: { deletedObjects: result.deletedObjects } })
  }

  handleSendText: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { text?: unknown }
    if (typeof body?.text !== 'string' || body.text.trim() === '') {
      throw new ValidationError('Campo `text` é obrigatório', VALIDATION_ERROR)
    }

    const sent = await this.dependencies.metaWhatsApp.conversations.send.sendText({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      body: body.text,
      // 'agent': saiu da inbox, por um humano. O bot usa o WhatsAppSender, não esta rota — a
      // distinção é o que permite a thread mostrar quem falou.
      sender: 'agent',
      startState: CONVERSATION_STATE.GREETING,
    })

    if (!sent) throw new NotFoundError('Conversa não encontrada', CONVERSATION_NOT_FOUND)
    response.json(201, { data: toMessagePayload(sent) })
  }

  // Sem object storage no QuickCart: o binário chega em base64, vai direto para a Meta pelo
  // uploadMedia do provider e não é persistido em lugar nenhum nosso.
  handleSendMedia: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { base64?: unknown; mimeType?: unknown; filename?: unknown; caption?: unknown }
    if (typeof body?.base64 !== 'string' || typeof body?.mimeType !== 'string' || typeof body?.filename !== 'string') {
      throw new ValidationError('Campos `base64`, `mimeType` e `filename` são obrigatórios', VALIDATION_ERROR)
    }

    const buffer = Buffer.from(body.base64, 'base64')

    // Validado ANTES de enviar, e não deixado para o storage recusar: o binário vai primeiro ao
    // cliente e só depois é copiado, então estourar o limite lá significaria cliente com o arquivo
    // na mão e biblioteca sem o registro. Barrar aqui mantém os dois lados coerentes.
    if (buffer.length > environment.STORAGE_MAX_OBJECT_SIZE_BYTES) {
      throw new ValidationError(
        `Arquivo excede o limite de ${environment.STORAGE_MAX_OBJECT_SIZE_BYTES} bytes`,
        VALIDATION_ERROR,
      )
    }

    const sent = await this.dependencies.metaWhatsApp.conversations.send.sendMedia({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      buffer,
      mimeType: body.mimeType,
      filename: body.filename,
      ...(typeof body.caption === 'string' ? { caption: body.caption } : {}),
      sender: 'agent',
      startState: CONVERSATION_STATE.GREETING,
    })

    if (!sent) throw new NotFoundError('Conversa não encontrada', CONVERSATION_NOT_FOUND)
    response.json(201, { data: toMessagePayload(sent) })
  }

  handleSendTemplate: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { templateName?: unknown; languageCode?: unknown; bodyParams?: unknown }
    if (typeof body?.templateName !== 'string') {
      throw new ValidationError('Campo `templateName` é obrigatório', VALIDATION_ERROR)
    }

    await this.dependencies.metaWhatsApp.conversations.send.sendTemplate({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      templateName: body.templateName,
      ...(typeof body.languageCode === 'string' ? { languageCode: body.languageCode } : {}),
      ...(Array.isArray(body.bodyParams) ? { bodyParams: body.bodyParams as string[] } : {}),
      sender: 'agent',
      startState: CONVERSATION_STATE.GREETING,
    })

    response.json(204, { data: null })
  }

  handleMarkRead: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    await this.dependencies.metaWhatsApp.conversations.repository.markRead(COMPANY_ID, requireNumber(request))
    response.json(204, { data: null })
  }

  handleGetContext: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const session = await this.dependencies.metaWhatsApp.conversations.repository.getContext(
      COMPANY_ID,
      requireNumber(request),
    )
    if (!session) throw new NotFoundError('Conversa não encontrada', CONVERSATION_NOT_FOUND)

    response.json(200, { data: session.context })
  }

  // Transcript completo para download/auditoria. O caso de uso já existia no módulo desde a Fase 3
  // e nunca tinha sido exposto — sem rota, a capacidade estava morta.
  handleExport: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const exported = await this.dependencies.metaWhatsApp.conversations.export.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
    })

    response.json(200, { data: exported })
  }

  // Assume a conversa para atendimento humano: o módulo passa mode='human' e, a partir daí,
  // o webhook para de entregar mensagens ao bot (ver ReceiveWebhook.use-case).
  handleTakeover: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as { agentUserId?: unknown }
    if (typeof body?.agentUserId !== 'string') {
      throw new ValidationError('Campo `agentUserId` é obrigatório', VALIDATION_ERROR)
    }

    await this.dependencies.metaWhatsApp.conversations.takeover.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
      agentUserId: body.agentUserId,
    })

    response.json(204, { data: null })
  }

  handleRelease: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    await this.dependencies.metaWhatsApp.conversations.release.execute({
      companyId: COMPANY_ID,
      whatsappNumber: requireNumber(request),
    })

    response.json(204, { data: null })
  }

  // Proxy de mídia: busca da Meta sob demanda em vez de guardar o binário. Cobre reouvir o
  // áudio da lista de compras na inbox — que é o caso que importa aqui — ao custo de só servir
  // mídia recente, já que a Meta expira o conteúdo em ~30 dias.
  handleMediaProxy: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const mediaId = request.params[0]
    if (!mediaId) throw new ValidationError('mediaId ausente na rota', VALIDATION_ERROR)

    const media = await this.dependencies.metaWhatsApp.channel.fetchMediaAsBase64(mediaId)
    response.json(200, { data: media })
  }
}
