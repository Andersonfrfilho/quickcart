/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useEffect, useState } from 'react'
import type { FlowGraphData } from '@adatechnology/conversations-ui/flows'
import { flowsApi } from '@/modules/flows/shared/flowsApi'

// O motor cria este fluxo no boot (`seedMainFlow`); é a raiz do mapa quando existe.
const ROOT_FLOW_KEY = 'main'

export type UseFlowMapResult = {
  readonly graphs: Record<string, FlowGraphData>
  readonly rootKey: string
  readonly loading: boolean
  readonly failure: string | undefined
}

export function useFlowMap(): UseFlowMapResult {
  const [graphs, setGraphs] = useState<Record<string, FlowGraphData>>({})
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  useEffect(() => {
    let active = true

    flowsApi
      .getAll()
      .then((loaded) => {
        if (active) setGraphs(loaded)
      })
      .catch((error: unknown) => {
        if (active) setFailure(error instanceof Error ? error.message : 'Falha ao carregar os fluxos.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Se `main` não existir (instalação sem seed), a raiz é o primeiro fluxo — o mapa sem raiz não
  // consegue calcular layout e renderizaria vazio sem explicar o motivo.
  const rootKey = graphs[ROOT_FLOW_KEY] ? ROOT_FLOW_KEY : (Object.keys(graphs)[0] ?? ROOT_FLOW_KEY)

  return { graphs, rootKey, loading, failure }
}
