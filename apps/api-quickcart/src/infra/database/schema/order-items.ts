/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * product_name e unit_price_in_cents são snapshot no momento do pedido — não seguem
 * o produto se o catálogo mudar depois (histórico do pedido deve ser imutável).
 * quantity é lido como string ($inferSelect) — Drizzle mapeia numeric assim para não
 * perder precisão; casos de uso convertem para number no limite da aplicação.
 */

import { pgTable, uuid, varchar, integer, numeric, timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { products } from './products'

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  productName: varchar('product_name', { length: 160 }).notNull(),
  unitPriceInCents: integer('unit_price_in_cents').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  totalInCents: integer('total_in_cents').notNull(),
  /**
   * Quando a loja descobriu, separando, que o item acabou.
   *
   * `null` é o normal — nem "disponível" nem "conferido", simplesmente nada aconteceu de anormal.
   * Guardar o INSTANTE e não um booleano porque a pergunta que aparece depois é sempre "quando
   * faltou", tanto para explicar ao cliente quanto para o lojista entender se falta sempre no mesmo
   * horário do dia.
   *
   * O item continua na linha do pedido, marcado. Apagar a linha esconderia do histórico que o cliente
   * pediu aquilo — que é justamente o dado mais valioso desse acontecimento.
   */
  unavailableAt: timestamp('unavailable_at', { withTimezone: true }),
  /**
   * Quando o CLIENTE foi avisado desta falta.
   *
   * Separado de `unavailableAt` porque marcar e avisar são momentos diferentes: quem separa marca três
   * itens andando pelo corredor, e o cliente deve receber UM recado com os três — não três mensagens.
   * `null` com `unavailableAt` preenchido é exatamente o estado "falta registrada, cliente ainda não
   * sabe", que é o que a tela precisa mostrar para alguém decidir avisar.
   */
  unavailableNotifiedAt: timestamp('unavailable_notified_at', { withTimezone: true }),
  /**
   * Quando alguém separou este item. `null` = ainda não separado.
   *
   * No servidor, e não no aparelho de quem separa: a marcação decide o que a tela conta para a próxima
   * pessoa, e por aparelho a esteira dizia "Separado" enquanto a lista dizia 0%.
   */
  pickedAt: timestamp('picked_at', { withTimezone: true }),
  /**
   * A linha que esta substitui — o item que faltou e que o cliente aceitou trocar.
   *
   * Linha NOVA e não linha reescrita, pela mesma razão de `unavailableAt`: sobrescrever `product_name`
   * apagaria que o cliente pediu outra coisa, que é o dado mais valioso do episódio — tanto para explicar
   * a sacola na porta quanto para a loja descobrir o que falta sempre.
   *
   * `null` é o normal: a esmagadora maioria das linhas é o que o cliente pediu. Com a origem apontada, a
   * troca inteira fica descrita — pedido, item de origem, produto de destino, diferença (a subtração dos
   * dois `total_in_cents`) e o instante (`created_at`).
   */
  substitutesOrderItemId: uuid('substitutes_order_item_id').references((): AnyPgColumn => orderItems.id, {
    onDelete: 'restrict',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
