/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cliente das rotas de fluxo. A listagem devolve só um resumo (`nodeCount`), então o mapa precisa
 * buscar cada grafo completo — o `FlowMapCanvas` desenha a partir dos nós, não da contagem.
 */

import type { FlowGraphData } from '@adatechnology/conversations-ui/flows'
import { adminRequest } from '@/modules/admin/shared/adminRequest'

export type FlowSummary = {
  readonly key: string
  readonly label: string
  readonly nodeCount: number
  readonly showInMenu: boolean
  readonly updatedAt: string
}

export type LiveFlowPosition = {
  readonly flowKey: string
  readonly nodeId: string
  readonly count: number
}

export const flowsApi = {
  list: (): Promise<FlowSummary[]> => adminRequest<FlowSummary[]>('/flows'),

  get: (key: string): Promise<FlowGraphData> => adminRequest<FlowGraphData>(`/flows/${encodeURIComponent(key)}`),

  livePositions: (): Promise<LiveFlowPosition[]> => adminRequest<LiveFlowPosition[]>('/flows/live-positions'),

  // Busca os grafos completos em paralelo: em série, uma loja com muitos fluxos abriria o mapa em
  // N vezes o tempo de ida e volta.
  async getAll(): Promise<Record<string, FlowGraphData>> {
    const summaries = await flowsApi.list()
    const graphs = await Promise.all(summaries.map((summary) => flowsApi.get(summary.key)))

    return Object.fromEntries(graphs.map((graph) => [graph.key, graph]))
  },
}
