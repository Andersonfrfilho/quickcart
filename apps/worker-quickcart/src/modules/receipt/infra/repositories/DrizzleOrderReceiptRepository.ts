import { eq } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { orders, orderItems } from '@/infra/database/schema'
import { customers } from '@/infra/database/schema/customers'
import type { OrderReceiptData } from '@/modules/receipt/application/types/OrderReceiptData.types'
import type { OrderReceiptRepository } from '@/modules/receipt/infra/repositories/OrderReceiptRepository.interface'

export class DrizzleOrderReceiptRepository implements OrderReceiptRepository {
  async findOrderReceiptData(orderId: string): Promise<OrderReceiptData | undefined> {
    const rows = await db
      .select({
        id: orders.id,
        shortCode: orders.shortCode,
        customerId: orders.customerId,
        totalInCents: orders.totalInCents,
        deliveryType: orders.deliveryType,
        address: orders.address,
        paymentMethod: orders.paymentMethod,
        receiptPreference: orders.receiptPreference,
        fiscalDocumentId: orders.fiscalDocumentId,
        createdAt: orders.createdAt,
        customerPhone: customers.phone,
        customerEmail: customers.email,
        customerName: customers.name,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, orderId))
      .limit(1)

    const row = rows[0]
    if (!row) return undefined

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))

    return {
      orderId: row.id,
      shortCode: row.shortCode,
      customerPhone: row.customerPhone,
      customerEmail: row.customerEmail,
      customerName: row.customerName,
      totalInCents: row.totalInCents,
      deliveryType: row.deliveryType,
      address: row.address,
      paymentMethod: row.paymentMethod,
      receiptPreference: row.receiptPreference,
      createdAt: row.createdAt,
      fiscalDocumentId: row.fiscalDocumentId,
      items: items.map((item) => ({
        productName: item.productName,
        unitPriceInCents: item.unitPriceInCents,
        quantity: Number(item.quantity),
        totalInCents: item.totalInCents,
      })),
    }
  }

  async markFiscalDocumentId(orderId: string, fiscalDocumentId: string): Promise<void> {
    await db.update(orders).set({ fiscalDocumentId }).where(eq(orders.id, orderId))
  }
}
