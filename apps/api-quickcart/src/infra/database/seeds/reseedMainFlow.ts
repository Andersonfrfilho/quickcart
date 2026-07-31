/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Reaplica o grafo do fluxo principal a partir de `MAIN_FLOW.seed`, descartando o que está gravado.
 *
 * Existe porque a semeadura do boot é deliberadamente uma-vez-só (`if (existing) return`): o grafo é
 * editável pelo painel, e sobrescrever a cada `bun dev` apagaria o trabalho de quem edita. O efeito
 * colateral é que mudar o arquivo da seed não muda nada num banco que já foi semeado — foi assim que
 * um fluxo novo ficou invisível enquanto o bot repetia a saudação antiga.
 *
 * Então a reaplicação é um comando explícito, e não um comportamento. Ele DESCARTA edição feita pelo
 * painel para aquela chave: é ferramenta de desenvolvimento do grafo, não de operação.
 */

import { closeDatabaseConnection } from '@/infra/database/connection'
import { container } from '@/infra/container'
import { environment } from '@/infra/config/environment'
import { MAIN_FLOW_SEED } from '@/modules/conversation/shared/MainFlow.seed'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const log = logger.child('ReseedMainFlow')

async function reseedMainFlow(): Promise<void> {
  const flows = container.webhook.metaWhatsApp.flows
  if (!flows) {
    log.warn('flow_engine_disabled')
    return
  }

  const companyId = environment.WHATSAPP_COMPANY_ID

  // Apagar e recriar, em vez de `save`: `save` exige a versão esperada para não atropelar edição
  // concorrente, e aqui a intenção declarada é justamente atropelar o que existir.
  await flows.delete.execute({ companyId, key: MAIN_FLOW_SEED.key })

  const graph = await flows.create.execute({
    companyId,
    key: MAIN_FLOW_SEED.key,
    label: MAIN_FLOW_SEED.label,
    startNodeId: MAIN_FLOW_SEED.startNodeId,
    nodes: MAIN_FLOW_SEED.nodes,
  })

  log.info('main_flow_reseeded', {
    key: MAIN_FLOW_SEED.key,
    startNodeId: MAIN_FLOW_SEED.startNodeId,
    // `nodes` é mapa por id, não lista — `.length` daria `undefined` e o campo sumiria do log.
    nodeCount: Object.keys(MAIN_FLOW_SEED.nodes).length,
    version: graph.version,
  })
}

/**
 * `process.exit` explícito, como a seed do catálogo: importar o container abre fila e Redis, que
 * seguram o event loop de pé. Sem isto o comando fica pendurado depois de terminar o trabalho —
 * para um script de uma tacada, sair É o encerramento.
 */
try {
  await reseedMainFlow()
  await closeDatabaseConnection()
  process.exit(0)
} catch (error) {
  log.error('reseed_failed', { error: serializeError(error) })
  await closeDatabaseConnection()
  process.exit(1)
}
