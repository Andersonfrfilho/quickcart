/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A ordem dos deletes não é estilo, é a única que o banco aceita.
 *
 * `carts.customer_id` e `orders.customer_id` são RESTRICT: apagar o cliente primeiro falha. O que
 * CASCATA a partir deles (`cart_items`, `order_items`, `order_delivery_attempts`) não aparece aqui
 * de propósito — repetir o cascade na mão esconderia o dia em que a FK mudar.
 *
 * `meta_whatsapp.*` e `customer.*` saem por SQL porque não vivem no schema Drizzle desta app: são
 * dos pacotes de módulo, que são donos das próprias tabelas. Parametrizado, nunca `sql.raw` — o
 * número vem de mensagem do WhatsApp, que é entrada hostil.
 */

import { inArray, sql } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { carts, customers, orders } from '@/infra/database/schema'
import type {
  CustomerResetRepositoryInterface,
  ResetCustomerByPhoneResult,
} from '@/modules/conversation/domain/CustomerResetRepository.interface'

const EMPTY_RESULT: ResetCustomerByPhoneResult = {
  deletedOrders: 0,
  deletedCarts: 0,
  deletedMessages: 0,
  deletedSessions: 0,
  deletedCustomers: 0,
}

export class DrizzleCustomerResetRepository implements CustomerResetRepositoryInterface {
  async resetByPhone(whatsAppNumber: string): Promise<ResetCustomerByPhoneResult> {
    return db.transaction(async (transaction) => {
      const customerRows = await transaction
        .select({ id: customers.id })
        .from(customers)
        .where(sql`${customers.phone} = ${whatsAppNumber}`)

      const customerIds = customerRows.map((row) => row.id)

      /*
       * Conversa sem cadastro acontece: quem digitou "reset" antes de dizer o nome tem sessão e
       * mensagens, e nenhum cliente. Sair cedo aqui deixaria esse caso sem limpeza nenhuma — que é
       * justamente o caso em que mais se digita "reset".
       */
      const conversationCounts = await this.deleteConversation(transaction, whatsAppNumber)
      if (customerIds.length === 0) return { ...EMPTY_RESULT, ...conversationCounts }

      const deletedOrders = await transaction
        .delete(orders)
        .where(inArray(orders.customerId, customerIds))
        .returning({ id: orders.id })

      const deletedCarts = await transaction
        .delete(carts)
        .where(inArray(carts.customerId, customerIds))
        .returning({ id: carts.id })

      await transaction.execute(
        sql`DELETE FROM customer.customers WHERE id IN (
              SELECT customer_id FROM customer.customer_phones WHERE number = ${whatsAppNumber}
            )`,
      )

      const deletedCustomers = await transaction
        .delete(customers)
        .where(inArray(customers.id, customerIds))
        .returning({ id: customers.id })

      return {
        ...conversationCounts,
        deletedOrders: deletedOrders.length,
        deletedCarts: deletedCarts.length,
        deletedCustomers: deletedCustomers.length,
      }
    })
  }

  private async deleteConversation(
    transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
    whatsAppNumber: string,
  ): Promise<Pick<ResetCustomerByPhoneResult, 'deletedMessages' | 'deletedSessions'>> {
    const deletedMessages = await transaction.execute(
      sql`DELETE FROM meta_whatsapp.messages WHERE whatsapp_number = ${whatsAppNumber} RETURNING id`,
    )
    const deletedSessions = await transaction.execute(
      sql`DELETE FROM meta_whatsapp.sessions WHERE whatsapp_number = ${whatsAppNumber} RETURNING id`,
    )

    return {
      deletedMessages: countRows(deletedMessages),
      deletedSessions: countRows(deletedSessions),
    }
  }
}

/**
 * O driver devolve `{ rows }` em alguns caminhos e o array direto em outros, conforme a versão.
 * Contar errado aqui não quebra nada visível — só faz o relatório do reset mentir, que é pior.
 */
function countRows(result: unknown): number {
  if (Array.isArray(result)) return result.length
  if (typeof result === 'object' && result !== null && 'rows' in result) {
    const { rows } = result as { rows: unknown }
    if (Array.isArray(rows)) return rows.length
  }
  return 0
}
