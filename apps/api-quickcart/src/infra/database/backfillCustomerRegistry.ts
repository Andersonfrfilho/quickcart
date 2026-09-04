/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { sql } from 'drizzle-orm'

import { db } from '@/infra/database/connection'
import { logger } from '@/shared/logger'

const log = logger.child('CustomerBackfill')

/**
 * Copia `public.customers` para o cadastro do pacote, na fase de EXPANSÃO.
 *
 * Nada é apagado: a tabela antiga continua sendo a identidade que `orders` e `carts` referenciam
 * por chave estrangeira, e o pacote passa a ser o cadastro (nome, documentos, endereços, campos do
 * produto). O `id` é PRESERVADO — é ele que liga as duas metades, e gerar um novo aqui tornaria
 * impossível dizer depois qual pedido é de qual ficha.
 *
 * Não vive no journal do host de propósito: as duas cadeias de migration têm journals separados, e
 * esta cópia precisa rodar DEPOIS de `runCustomerMigrations` criar o schema. A ordem entre journals
 * é decidida em código, como já acontece com o meta_whatsapp (ver `connection.ts`).
 *
 * Idempotente: roda a cada boot e não faz nada quando não há o que copiar.
 */
export async function backfillCustomerRegistry(): Promise<void> {
  const inserted = await db.execute(sql`
    INSERT INTO "customer"."customers" ("id", "name", "email", "external_user_id", "created_at", "updated_at")
    SELECT "id", "name", "email", "user_id", "created_at", "updated_at"
    FROM "public"."customers"
    ON CONFLICT ("id") DO NOTHING
  `)

  /*
   * O telefone do legado é o número do WhatsApp: ele nasce de `message.from`, que é por onde a
   * pessoa falou com a loja. Marcar `is_whatsapp` é o que faz a próxima mensagem dela encontrar a
   * ficha em vez de criar uma segunda.
   *
   * `WHERE NOT EXISTS` e não `ON CONFLICT`: o índice único de WhatsApp é parcial, e o `ON CONFLICT`
   * do Postgres não casa com índice parcial sem repetir o predicado inteiro — a checagem explícita
   * diz a mesma coisa e sobrevive a uma mudança no índice.
   */
  const phones = await db.execute(sql`
    INSERT INTO "customer"."customer_phones" ("customer_id", "number", "is_whatsapp", "is_primary")
    SELECT c."id", regexp_replace(c."phone", '\D', '', 'g'), true, true
    FROM "public"."customers" c
    WHERE c."phone" IS NOT NULL
      AND regexp_replace(c."phone", '\D', '', 'g') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "customer"."customer_phones" p WHERE p."customer_id" = c."id"
      )
  `)

  const customerCount = inserted.rowCount ?? 0
  const phoneCount = phones.rowCount ?? 0

  if (customerCount > 0 || phoneCount > 0) {
    log.info('backfilled', { customers: customerCount, phones: phoneCount })
  }
}
