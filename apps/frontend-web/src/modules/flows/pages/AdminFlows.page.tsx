/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Editor de fluxos. A tela é o `FlowsWorkspace` do pacote — canvas, mapa, paleta, painel de nó,
 * validação e posições vivas vêm de lá, iguais aos outros produtos. Aqui fica só o que é nosso:
 * as rotas da API e a chave do fluxo raiz.
 */

import '@adatechnology/conversations-ui/styles.css'
import { FlowsWorkspace, type FlowsWorkspaceApi } from '@adatechnology/conversations-ui/flows'
import { flowsApi, ROOT_FLOW_KEY } from '@/modules/flows/shared/flowsApi'

const FLOWS_API: FlowsWorkspaceApi = {
  getGraphs: flowsApi.getAll,
  // O save é otimista por versão no servidor: a versão vai no corpo e um 409 avisa que outra
  // pessoa gravou antes.
  saveGraph: (key, graph) => flowsApi.save(key, graph),
  createFlow: flowsApi.create,
  deleteFlow: flowsApi.remove,
  getLivePositions: flowsApi.livePositions,
}

export function AdminFlowsPage() {
  return <FlowsWorkspace api={FLOWS_API} rootFlowKey={ROOT_FLOW_KEY} />
}
