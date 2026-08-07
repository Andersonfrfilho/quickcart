/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cliente das rotas de fluxo. A listagem devolve só um resumo (`nodeCount`), então o editor precisa
 * buscar cada grafo completo — o canvas desenha a partir dos nós, não da contagem.
 */

import type { CreateFlowInput, FlowGraphData, FlowLivePosition } from '@adatechnology/conversations-ui/flows'
import { adminRequest } from '@/modules/admin/shared/adminRequest'

// O motor cria este fluxo no boot (`seedMainFlow`); é a raiz do editor quando existe.
export const ROOT_FLOW_KEY = 'main'

export type FlowSummary = {
  readonly key: string
  readonly label: string
  readonly nodeCount: number
  readonly showInMenu: boolean
  readonly updatedAt: string
}

export const flowsApi = {
  list: (): Promise<FlowSummary[]> => adminRequest<FlowSummary[]>('/flows'),

  get: (key: string): Promise<FlowGraphData> => adminRequest<FlowGraphData>(`/flows/${encodeURIComponent(key)}`),

  // `expectedVersion` sai do próprio grafo carregado: é assim que o servidor detecta que outra
  // pessoa gravou no meio da edição e responde 409 em vez de sobrescrever em silêncio.
  save: async (key: string, graph: FlowGraphData): Promise<void> => {
    await adminRequest(`/flows/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ graph, expectedVersion: graph.version }),
    })
  },

  create: async (input: CreateFlowInput): Promise<void> => {
    await adminRequest('/flows', { method: 'POST', body: JSON.stringify(input) })
  },

  remove: async (key: string): Promise<void> => {
    await adminRequest(`/flows/${encodeURIComponent(key)}`, { method: 'DELETE' })
  },

  livePositions: (): Promise<FlowLivePosition[]> => adminRequest<FlowLivePosition[]>('/flows/live-positions'),

  // Busca os grafos completos em paralelo: em série, uma loja com muitos fluxos abriria o mapa em
  // N vezes o tempo de ida e volta.
  async getAll(): Promise<Record<string, FlowGraphData>> {
    const summaries = await flowsApi.list()
    const graphs = await Promise.all(summaries.map((summary) => flowsApi.get(summary.key)))

    return Object.fromEntries(graphs.map((graph) => [graph.key, graph]))
  },
}
