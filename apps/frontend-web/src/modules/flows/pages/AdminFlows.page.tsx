/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mapa dos fluxos do bot: cada fluxo é um nó, ligado aos outros pelos saltos `flow:<key>`. É a
 * visão de leitura — o grafo que o `FlowInterpreter` executa em produção, lido de
 * `meta_whatsapp.flow_graphs`.
 */

import '@adatechnology/conversations-ui/styles.css'
import '@xyflow/react/dist/style.css'
import { FlowMapCanvas } from '@adatechnology/conversations-ui/flows'
import { useFlowMap } from '@/modules/flows/hooks/useFlowMap.hook'

export function AdminFlowsPage() {
  const { graphs, rootKey, loading, failure } = useFlowMap()

  if (loading) return <p className="p-6 text-sm text-gray-500">Carregando fluxos…</p>

  if (failure) {
    return (
      <p role="alert" className="p-6 text-sm text-red-600 dark:text-red-400">
        {failure}
      </p>
    )
  }

  if (Object.keys(graphs).length === 0) {
    return <p className="p-6 text-sm text-gray-500">Nenhum fluxo cadastrado.</p>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Superfície de altura cheia: fica sem borda no celular (o canvas quer todo o espaço) e só o
          cabeçalho carrega o respiro, mais apertado que no desktop. */}
      <header className="border-b px-4 py-3 lg:px-6 lg:py-4">
        <h1 className="text-xl font-semibold">Fluxo do bot</h1>
        <p className="text-sm text-gray-500">
          {Object.keys(graphs).length} fluxo(s) — raiz: {rootKey}
        </p>
      </header>

      <div className="min-h-0 flex-1">
        <FlowMapCanvas graphs={graphs} rootKey={rootKey} onOpenFlow={() => undefined} />
      </div>
    </div>
  )
}
