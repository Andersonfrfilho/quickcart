/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { customers, type Customer } from '@/infra/database/schema'
import { generateId } from '@/shared/id'
import { logger } from '@/shared/logger'
import type {
  CustomerRepositoryInterface,
  LinkCustomerToUserParams,
  UpdateContactInfoParams,
  UpsertCustomerByPhoneParams,
} from '@/modules/webhook/domain/CustomerRepository.interface'

const customerLog = logger.child('CustomerRegistry')

export class DrizzleCustomerRepository implements CustomerRepositoryInterface {
  async findById(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    return customer
  }

  async findByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1)
    return customer
  }

  async findByUserId(userId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, userId)).limit(1)
    return customer
  }

  async linkToUser(params: LinkCustomerToUserParams): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({ userId: params.userId, updatedAt: new Date() })
      .where(eq(customers.id, params.customerId))
      .returning()

    return customer as Customer
  }

  async upsertByPhone(params: UpsertCustomerByPhoneParams): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values({ id: generateId(), phone: params.phone, name: params.name ?? null })
      .onConflictDoUpdate({
        target: customers.phone,
        set: { updatedAt: new Date(), ...(params.name ? { name: params.name } : {}) },
      })
      .returning()

    await mirrorIntoRegistry(customer as Customer)

    return customer as Customer
  }

  async updateContactInfo(params: UpdateContactInfoParams): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({
        updatedAt: new Date(),
        ...(params.email !== undefined ? { email: params.email } : {}),
      })
      .where(eq(customers.id, params.customerId))
      .returning()

    return customer as Customer
  }
}

/**
 * Espelha o cliente no cadastro do pacote, com o MESMO id.
 *
 * Escrita nos dois lugares é dívida assumida, e é a fase de expansão: `orders` e `carts` referenciam
 * `public.customers` por chave estrangeira, então ela não pode parar de receber; e o cadastro
 * precisa da pessoa para o painel mostrar a ficha de quem acabou de mandar mensagem. A contração —
 * apontar os pedidos para o pacote e apagar a tabela antiga — vem depois de rodar em produção
 * assim, com plano de rollback escrito (`database.md`).
 *
 * Fica AQUI e não nos três pontos de entrada (webhook, pedido pela web, cadastro na loja) porque
 * espelhar em três lugares é como os três divergem.
 *
 * Nunca derruba o fluxo de quem está falando com a loja: o legado já gravou, o pedido continua, e
 * uma ficha ausente no painel é conserto de boot (o backfill roda de novo), não perda de venda.
 */
async function mirrorIntoRegistry(customer: Customer): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO "customer"."customers" ("id", "name", "email", "external_user_id", "created_at", "updated_at")
      VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.userId}, ${customer.createdAt}, ${customer.updatedAt})
      ON CONFLICT ("id") DO UPDATE SET
        "name" = COALESCE(EXCLUDED."name", "customer"."customers"."name"),
        "email" = COALESCE(EXCLUDED."email", "customer"."customers"."email"),
        "external_user_id" = COALESCE(EXCLUDED."external_user_id", "customer"."customers"."external_user_id"),
        "updated_at" = EXCLUDED."updated_at"
    `)

    await db.execute(sql`
      INSERT INTO "customer"."customer_phones" ("customer_id", "number", "is_whatsapp", "is_primary")
      SELECT ${customer.id}::uuid, ${customer.phone.replace(/\D/g, '')}, true, true
      WHERE NOT EXISTS (
        SELECT 1 FROM "customer"."customer_phones" p WHERE p."customer_id" = ${customer.id}::uuid
      )
    `)
  } catch (error) {
    customerLog.warn('registry_mirror_failed', { customerId: customer.id, error: String(error) })
  }
}
