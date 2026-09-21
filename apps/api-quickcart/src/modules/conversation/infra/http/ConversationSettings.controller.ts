/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Configurações de conversa (boas-vindas, despedida) e CRUD dos grafos de fluxo. Ambos vivem
 * em tabelas do módulo, não do QuickCart — o lojista edita pela UI sem precisar de deploy, que
 * é a razão de a mensagem de boas-vindas não ser mais uma constante no código.
 */

import { z } from 'zod'
import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import type { FlowGraphData, TranscriptionMode, WhatsAppSettings } from '@adatechnology/meta-whatsapp-contracts'
import { OptimisticLockError } from '@adatechnology/meta-whatsapp-module'
import type { WhatsAppTemplateProvider } from '@adatechnology/meta-whatsapp-provider'
import type { RouteHandler } from '@/infra/http/router'
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { ADMIN_ONLY } from '@/modules/user/shared/User.constant'
import { environment } from '@/infra/config/environment'
import { ValidationError, ConflictError, NotFoundError } from '@/shared/errors/AppError.error'
import { CONVERSATION_NOT_FOUND, VALIDATION_ERROR } from '@/shared/errors/codes'

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

type ConversationSettingsControllerDependencies = {
  readonly metaWhatsApp: MetaWhatsAppModule
  readonly templates: WhatsAppTemplateProvider
}

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['UTILITY', 'MARKETING']),
  language: z.string().min(2).max(20),
  headerType: z.enum(['NONE', 'TEXT']),
  headerText: z.string().max(60).optional(),
  bodyText: z.string().min(1).max(1024),
  footerText: z.string().max(60).optional(),
})

function requireFlows(module: MetaWhatsAppModule) {
  // `flows` é undefined quando features.flowEngine está desligado. Uma rota que devolvesse 500
  // aqui esconderia a causa; 400 com a razão explícita é o que faz a UI dizer algo útil.
  if (!module.flows) {
    throw new ValidationError('Motor de fluxo desligado nesta instalação', VALIDATION_ERROR)
  }
  return module.flows
}

const TRANSCRIPTION_MODES = ['auto', 'onDemand'] as const

/**
 * Valida os campos de transcrição do corpo, que de resto é repassado cru ao módulo.
 *
 * `transcription_mode` é `varchar` no banco, então sem esta checagem qualquer string entraria — e
 * embora o módulo normalize modo desconhecido na leitura (caindo no padrão do host), gravar lixo
 * transformaria "escolhi automático" numa configuração que silenciosamente não vale nada.
 *
 * `null` é valor legítimo nos dois campos: significa "voltar a herdar o padrão da instalação".
 */
function parseTranscriptionPolicy(body: Record<string, unknown>): Partial<WhatsAppSettings> {
  const policy: Partial<WhatsAppSettings> = {}

  if ('transcriptionEnabled' in body) {
    const enabled = body['transcriptionEnabled']
    if (enabled !== null && typeof enabled !== 'boolean') {
      throw new ValidationError('transcriptionEnabled deve ser booleano ou nulo', VALIDATION_ERROR)
    }
    policy.transcriptionEnabled = enabled
  }

  if ('transcriptionMode' in body) {
    const mode = body['transcriptionMode']
    if (mode !== null && !TRANSCRIPTION_MODES.includes(mode as TranscriptionMode)) {
      throw new ValidationError(
        `transcriptionMode deve ser ${TRANSCRIPTION_MODES.join(' ou ')}, ou nulo`,
        VALIDATION_ERROR,
      )
    }
    policy.transcriptionMode = mode as TranscriptionMode | null
  }

  return policy
}

export class ConversationSettingsController {
  constructor(private readonly dependencies: ConversationSettingsControllerDependencies) {}

  handleGetSettings: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const settings = await this.dependencies.metaWhatsApp.settings.get(COMPANY_ID)

    const transcription = this.dependencies.metaWhatsApp.transcription

    /**
     * Dois booleanos porque são duas perguntas diferentes, com dois consumidores diferentes:
     *
     * - `transcriptionAvailable` — "o ambiente CONSEGUE?" (engine e credencial configurados). É o que
     *   o formulário de configurações usa para avisar e travar os campos: sem isso, o lojista ligaria
     *   o interruptor num deploy sem engine e concluiria que o produto está quebrado.
     *
     * - `transcriptionActive` — "está valendo AGORA para esta empresa?", já com a política resolvida
     *   (capacidade + escolha do painel + padrão da instalação). É o que a inbox usa para decidir se
     *   desenha o botão "transcrever". Resolvido no servidor de propósito: o cliente não conhece o
     *   padrão do deploy, e deixá-lo inferir a partir do tri-state seria pedir que ele adivinhe.
     */
    const policy = transcription ? await transcription.resolvePolicy(COMPANY_ID) : undefined

    response.json(200, {
      data: {
        ...settings,
        transcriptionAvailable: transcription !== undefined,
        transcriptionActive: policy?.isEnabled ?? false,
      },
    })
  }

  handleSaveSettings: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const body = request.body as Record<string, unknown>
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Corpo da requisição inválido', VALIDATION_ERROR)
    }

    const settings = await this.dependencies.metaWhatsApp.settings.save(COMPANY_ID, {
      ...body,
      ...parseTranscriptionPolicy(body),
    })
    response.json(200, { data: settings })
  }

  // Templates vêm da Meta a cada leitura, não de cópia local: quem aprova/reprova é a Meta, e um
  // cache aqui mostraria como disponível um template já rejeitado.
  handleListTemplates: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const templates = await this.dependencies.templates.listTemplates()
    response.json(200, { data: templates })
  }

  handleCreateTemplate: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const parsed = createTemplateSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError('Validation failed', VALIDATION_ERROR)
    }

    const { headerText, footerText, ...template } = parsed.data
    const result = await this.dependencies.templates.createTemplate({
      ...template,
      ...(headerText !== undefined ? { headerText } : {}),
      ...(footerText !== undefined ? { footerText } : {}),
    })
    response.json(201, { data: result })
  }

  handleListFlows: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const flows = await requireFlows(this.dependencies.metaWhatsApp).list.execute({ companyId: COMPANY_ID })
    response.json(200, { data: flows })
  }

  handleGetFlow: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const key = request.params[0]
    if (!key) throw new ValidationError('Chave do fluxo ausente', VALIDATION_ERROR)

    const flow = await requireFlows(this.dependencies.metaWhatsApp).get.execute({ companyId: COMPANY_ID, key })
    if (!flow) throw new NotFoundError(`Fluxo ${key} não encontrado`, CONVERSATION_NOT_FOUND)

    response.json(200, { data: flow })
  }

  handleCreateFlow: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const body = request.body as { key?: unknown; label?: unknown; startNodeId?: unknown; nodes?: unknown }
    if (typeof body?.key !== 'string' || typeof body?.label !== 'string') {
      throw new ValidationError('Campos `key` e `label` são obrigatórios', VALIDATION_ERROR)
    }

    // O editor cria o grafo já com um nó inicial; quando não manda nenhum, nasce um grafo vazio
    // apontando para 'start' — melhor que recusar e obrigar a UI a inventar a estrutura mínima.
    const startNodeId = typeof body.startNodeId === 'string' ? body.startNodeId : 'start'
    const flow = await requireFlows(this.dependencies.metaWhatsApp).create.execute({
      companyId: COMPANY_ID,
      key: body.key,
      label: body.label,
      startNodeId,
      nodes: (body.nodes as FlowGraphData['nodes']) ?? {},
    })
    response.json(201, { data: flow })
  }

  // O save é otimista por versão: dois atendentes editando o mesmo fluxo não sobrescrevem um ao
  // outro em silêncio — o segundo recebe 409 e a UI pede para recarregar.
  handleSaveFlow: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const key = request.params[0]
    if (!key) throw new ValidationError('Chave do fluxo ausente', VALIDATION_ERROR)

    const body = request.body as { graph?: FlowGraphData; expectedVersion?: unknown }
    if (typeof body?.expectedVersion !== 'number' || !body.graph) {
      throw new ValidationError('Campos `graph` e `expectedVersion` são obrigatórios', VALIDATION_ERROR)
    }

    try {
      const flow = await requireFlows(this.dependencies.metaWhatsApp).save.execute({
        companyId: COMPANY_ID,
        // A chave da rota manda sobre a do corpo: renomear um fluxo por PUT criaria um segundo
        // grafo em vez de atualizar o da URL.
        graph: { ...body.graph, key },
        expectedVersion: body.expectedVersion,
      })
      response.json(200, { data: flow })
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new ConflictError('O fluxo foi alterado por outra pessoa — recarregue antes de gravar', VALIDATION_ERROR)
      }
      throw error
    }
  }

  handleDeleteFlow: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const key = request.params[0]
    if (!key) throw new ValidationError('Chave do fluxo ausente', VALIDATION_ERROR)

    await requireFlows(this.dependencies.metaWhatsApp).delete.execute({ companyId: COMPANY_ID, key })
    response.json(204, { data: null })
  }

  // Quantas conversas estão paradas em cada nó agora — é o que pinta o contador no editor.
  handleLiveFlowPositions: RouteHandler = async (request, response) => {
    await requireSession({ request, roles: ADMIN_ONLY })
    const positions = await requireFlows(this.dependencies.metaWhatsApp).livePositions.execute({
      companyId: COMPANY_ID,
    })
    response.json(200, { data: positions })
  }
}
