/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Inventário das formas de endereço gravadas — SÓ LEITURA (`make address-inventory`).
 *
 * Existe porque a Fase 4 da spec de distância/ETA propunha reescrever os `jsonb` de endereço a partir
 * de texto livre, e a decisão de não fazer isso (docs/adr/0001) foi tomada com dados de DEV: sete
 * pedidos. Antes de qualquer conclusão sobre produção, é este script que mede lá — sem escrever
 * nada, então pode rodar em qualquer ambiente sem plano de rollback.
 *
 * Mede só `orders`. Media `customers.default_address` também, até a migração 0012 dropar a coluna:
 * ela nunca teve escritor, e cliente não guarda endereço — o endereço de entrega vive no pedido.
 *
 * NENHUM ENDEREÇO É IMPRESSO. Endereço completo é dado pessoal (security.md §1), e um inventário
 * que despeja endereços numa saída de terminal ou log de CI vira justamente o vazamento que a regra
 * proíbe — a decisão aqui depende de CONTAGENS, não de ler o que cada cliente escreveu.
 */

import { sql } from 'drizzle-orm'
import { db, closeDatabaseConnection } from './connection'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const log = logger.child('AddressInventory')

/**
 * As cinco chaves obrigatórias de `addressSchema`. Um objeto sem todas as cinco não é endereço
 * estruturado — é o que `isStructuredAddress` (frontend) e `formatAddressLine` (api) já decidem, e
 * o inventário precisa contar pela MESMA régua, senão mede uma coisa e a tela mostra outra.
 */
const STRUCTURED_KEYS = ['street', 'number', 'neighborhood', 'city', 'state'] as const

/**
 * O regex do `addressSchema` aplicado a TEXTO LIVRE, que é uma coisa diferente de validar um campo
 * de CEP: em texto, ele casa com celular (`98888-7777` → `98888-777`) e com CPF (`01415000123` →
 * `01415000`, que é um CEP real em São Paulo). A contagem `textoCruComCandidatoCep` NÃO é "quantos
 * dão para geocodificar" — é o tamanho do conjunto ambíguo.
 */
const CEP_CANDIDATE = `\\d{5}-?\\d{3}`

type AddressShapeCounts = {
  readonly total: number
  readonly nulo: number
  readonly estruturado: number
  readonly objetoParcial: number
  readonly textoCru: number
  /** Entre os textos crus, quantos contêm 8 dígitos — o conjunto AMBÍGUO, não o geocodificável. */
  readonly textoCruComCandidatoCep: number
  readonly comLegado: number
}

async function countShapes(table: 'orders', column: string): Promise<AddressShapeCounts> {
  const structuredCondition = STRUCTURED_KEYS.map((key) => `${column} ? '${key}'`).join(' and ')

  const result = await db.execute<Record<string, string>>(
    sql.raw(`
      select
        count(*) as total,
        count(*) filter (where ${column} is null) as nulo,
        count(*) filter (where jsonb_typeof(${column}) = 'object' and ${structuredCondition}) as estruturado,
        count(*) filter (where jsonb_typeof(${column}) = 'object' and not (${structuredCondition})) as objeto_parcial,
        count(*) filter (where jsonb_typeof(${column}) = 'string') as texto_cru,
        count(*) filter (
          where jsonb_typeof(${column}) = 'string' and ${column}::text ~ '${CEP_CANDIDATE}'
        ) as texto_cru_com_candidato_cep,
        count(*) filter (where legacy_address_text is not null) as com_legado
      from ${table}
    `),
  )

  const row = result.rows[0]
  const read = (key: string): number => Number(row?.[key] ?? 0)

  return {
    total: read('total'),
    nulo: read('nulo'),
    estruturado: read('estruturado'),
    objetoParcial: read('objeto_parcial'),
    textoCru: read('texto_cru'),
    textoCruComCandidatoCep: read('texto_cru_com_candidato_cep'),
    comLegado: read('com_legado'),
  }
}

async function runInventory(): Promise<void> {
  /*
   * `sql.raw` com nome de tabela/coluna fixo no código, nunca com valor de usuário — a exceção que
   * database.md permite, e o motivo está aqui: identificadores não são parametrizáveis em Postgres.
   */
  /*
   * Só pedidos.
   *
   * `customers.default_address` e `customers.legacy_address_text` saíram na migração 0012 — eram as
   * colunas mortas que a ADR 0001 usou como razão nº 2 para cancelar o backfill, e a decisão sobre
   * elas foi tomada depois. Não há mais forma de endereço de cliente para inventariar.
   */
  const orders = await countShapes('orders', 'address')

  log.info('address_inventory', { orders })
}

runInventory()
  .then(() => closeDatabaseConnection())
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    log.error('address_inventory_failed', { error: serializeError(error) })
    process.exit(1)
  })
