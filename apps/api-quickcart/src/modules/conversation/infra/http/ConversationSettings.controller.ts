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

import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import type { FlowGraphData } from '@adatechnology/meta-whatsapp-contracts'
import { OptimisticLockError } from '@adatechnology/meta-whatsapp-module'
import type { RouteHandler } from '@/infra/http/router'
import { requireAdminToken } from '@/infra/http/middlewares/requireAdminToken'
import { environment } from '@/infra/config/environment'
import { ValidationError, ConflictError, NotFoundError } from '@/shared/errors/AppError.error'
import { CONVERSATION_NOT_FOUND, VALIDATION_ERROR } from '@/shared/errors/codes'

const COMPANY_ID = environment.WHATSAPP_COMPANY_ID

type ConversationSettingsControllerDependencies = {
  readonly metaWhatsApp: MetaWhatsAppModule
}

function requireFlows(module: MetaWhatsAppModule) {
  // `flows` é undefined quando features.flowEngine está desligado. Uma rota que devolvesse 500
  // aqui esconderia a causa; 400 com a razão explícita é o que faz a UI dizer algo útil.
  if (!module.flows) {
    throw new ValidationError('Motor de fluxo desligado nesta instalação', VALIDATION_ERROR)
  }
  return module.flows
}

export class ConversationSettingsController {
  constructor(private readonly dependencies: ConversationSettingsControllerDependencies) {}

  handleGetSettings: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const settings = await this.dependencies.metaWhatsApp.settings.get(COMPANY_ID)
    response.json(200, { data: settings })
  }

  handleSaveSettings: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const body = request.body as Record<string, unknown>
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Corpo da requisição inválido', VALIDATION_ERROR)
    }

    const settings = await this.dependencies.metaWhatsApp.settings.save(COMPANY_ID, body)
    response.json(200, { data: settings })
  }

  handleListFlows: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const flows = await requireFlows(this.dependencies.metaWhatsApp).list.execute({ companyId: COMPANY_ID })
    response.json(200, { data: flows })
  }

  handleGetFlow: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const key = request.params[0]
    if (!key) throw new ValidationError('Chave do fluxo ausente', VALIDATION_ERROR)

    const flow = await requireFlows(this.dependencies.metaWhatsApp).get.execute({ companyId: COMPANY_ID, key })
    if (!flow) throw new NotFoundError(`Fluxo ${key} não encontrado`, CONVERSATION_NOT_FOUND)

    response.json(200, { data: flow })
  }

  handleCreateFlow: RouteHandler = async (request, response) => {
    requireAdminToken(request)
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
    requireAdminToken(request)
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
    requireAdminToken(request)
    const key = request.params[0]
    if (!key) throw new ValidationError('Chave do fluxo ausente', VALIDATION_ERROR)

    await requireFlows(this.dependencies.metaWhatsApp).delete.execute({ companyId: COMPANY_ID, key })
    response.json(204, { data: null })
  }

  // Quantas conversas estão paradas em cada nó agora — é o que pinta o contador no editor.
  handleLiveFlowPositions: RouteHandler = async (request, response) => {
    requireAdminToken(request)
    const positions = await requireFlows(this.dependencies.metaWhatsApp).livePositions.execute({
      companyId: COMPANY_ID,
    })
    response.json(200, { data: positions })
  }
}
