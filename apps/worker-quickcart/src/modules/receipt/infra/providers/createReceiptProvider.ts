import type { ReceiptProvider } from '@/modules/receipt/application/providers/ReceiptProvider.interface'
import { SimpleReceiptProvider } from '@/modules/receipt/infra/providers/SimpleReceiptProvider'
import { FiscalReceiptProvider } from '@/modules/receipt/infra/providers/FiscalReceiptProvider'
import { environment } from '@/infra/config/environment'

export function createReceiptProvider(): ReceiptProvider {
  if (!environment.FISCAL_ENABLED) {
    return new SimpleReceiptProvider()
  }

  return new FiscalReceiptProvider()
}
