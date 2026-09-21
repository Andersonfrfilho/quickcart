/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq, sql } from 'drizzle-orm'

import { db } from '@/infra/database/connection'
import { customers } from '@/infra/database/schema'
import { DrizzleCustomerRepository } from '@/modules/webhook/infra/database/DrizzleCustomerRepository'

const TELEFONE = '5516900000001'
const repository = new DrizzleCustomerRepository()

async function limpar(): Promise<void> {
  await db.delete(customers).where(eq(customers.phone, TELEFONE))
  await db.execute(sql`delete from "customer"."customers" where "id" not in (select "id" from "public"."customers")`)
}

beforeEach(limpar)
afterAll(limpar)

/**
 * O nome do perfil do WhatsApp preenche a ficha em branco e NUNCA sobrescreve.
 *
 * O atendente que corrige "Joana" para "Joana — Padaria Central" não pode ver a correção sumir na
 * próxima mensagem que a cliente mandar. É por isso que `fallbackName` existe separado de `name`.
 */
describe('nome do cliente vindo do WhatsApp', () => {
  test('preenche a ficha que nasce sem nome', async () => {
    const customer = await repository.upsertByPhone({ phone: TELEFONE, fallbackName: 'Joana Pereira' })

    expect(customer.name).toBe('Joana Pereira')
  })

  test('NÃO sobrescreve o nome que alguém já corrigiu', async () => {
    await repository.upsertByPhone({ phone: TELEFONE, fallbackName: 'Joana Pereira' })
    await repository.upsertByPhone({ phone: TELEFONE, name: 'Joana — Padaria Central' })

    const depoisDeNovaMensagem = await repository.upsertByPhone({ phone: TELEFONE, fallbackName: 'Joana Pereira' })

    expect(depoisDeNovaMensagem.name).toBe('Joana — Padaria Central')
  })

  test('mensagem sem nome de perfil não apaga o nome que existe', async () => {
    await repository.upsertByPhone({ phone: TELEFONE, fallbackName: 'Joana Pereira' })

    const depois = await repository.upsertByPhone({ phone: TELEFONE })

    expect(depois.name).toBe('Joana Pereira')
  })

  test('o nome chega ao CADASTRO, e não só ao legado', async () => {
    const customer = await repository.upsertByPhone({ phone: TELEFONE, fallbackName: 'Joana Pereira' })

    const { rows } = await db.execute(
      sql`select "name" from "customer"."customers" where "id" = ${customer.id}::uuid`,
    )

    expect(rows[0]?.['name']).toBe('Joana Pereira')
  })

  test('correção no CADASTRO sobrevive à próxima mensagem', async () => {
    const customer = await repository.upsertByPhone({ phone: TELEFONE, fallbackName: 'Joana Pereira' })
    await db.execute(
      sql`update "customer"."customers" set "name" = 'Joana — Padaria Central' where "id" = ${customer.id}::uuid`,
    )

    await repository.upsertByPhone({ phone: TELEFONE, fallbackName: 'Joana Pereira' })

    const { rows } = await db.execute(
      sql`select "name" from "customer"."customers" where "id" = ${customer.id}::uuid`,
    )
    expect(rows[0]?.['name']).toBe('Joana — Padaria Central')
  })
})
