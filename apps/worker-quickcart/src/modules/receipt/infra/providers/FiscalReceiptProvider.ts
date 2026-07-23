/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { createFiscalProvider, PaymentMethod } from '@adatechnology/fiscal-provider'
import type { NfceConfig, FiscalItem, FiscalPayment } from '@adatechnology/fiscal-provider'
import type { ReceiptProvider, ReceiptParams, ReceiptResult } from '@/modules/receipt/application/providers/ReceiptProvider.interface'
import { SimpleReceiptProvider } from '@/modules/receipt/infra/providers/SimpleReceiptProvider'
import { queueConnection } from '@/infra/queue/connection'
import { environment } from '@/infra/config/environment'
import { PAYMENT_METHOD } from '@/shared/Order.constant'
import { LOG_EVENTS } from '@/shared/log-events.constant'
import { logger } from '@/shared/logger'

const fiscalLog = logger.child('FiscalReceiptProvider')

const NFCE_NUMERO_SEQUENCE_KEY = 'fiscal:nfce:numero:sequence'

// Requisitos obrigatórios de NfceConfig que a env schema mantém opcionais — só são
// exigidos quando FISCAL_ENABLED=true (evita quebrar o boot com FISCAL_ENABLED=false).
const REQUIRED_FISCAL_ENV_KEYS = [
  'FISCAL_CNPJ',
  'FISCAL_RAZAO_SOCIAL',
  'FISCAL_UF',
  'FISCAL_MUNICIPIO',
  'FISCAL_CODIGO_MUNICIPIO',
  'FISCAL_CEP',
  'FISCAL_LOGRADOURO',
  'FISCAL_NUMERO_ENDERECO',
  'FISCAL_BAIRRO',
  'FISCAL_CERTIFICADO_BASE64',
  'FISCAL_CERTIFICADO_SENHA',
  'FISCAL_CSC_ID',
  'FISCAL_CSC_TOKEN',
] as const

const RECEIPT_TO_FISCAL_PAYMENT_METHOD: Record<string, (typeof PaymentMethod)[keyof typeof PaymentMethod]> = {
  [PAYMENT_METHOD.PIX]: PaymentMethod.PIX,
  [PAYMENT_METHOD.CARD_ON_DELIVERY]: PaymentMethod.CARD_CREDIT,
  [PAYMENT_METHOD.CASH]: PaymentMethod.CASH,
}

function assertFiscalConfigComplete(): void {
  const missing = REQUIRED_FISCAL_ENV_KEYS.filter((key) => !environment[key])
  if (missing.length > 0) {
    throw new Error(`fiscal_config_incomplete: missing ${missing.join(', ')}`)
  }
}

export class FiscalReceiptProvider implements ReceiptProvider {
  private readonly fallback = new SimpleReceiptProvider()

  constructor() {
    assertFiscalConfigComplete()
  }

  async generate(params: ReceiptParams): Promise<ReceiptResult> {
    try {
      return await this.emitFiscal(params)
    } catch (error) {
      fiscalLog.error(LOG_EVENTS.RECEIPT_FISCAL_EMIT_FAILED, { shortCode: params.shortCode, error: String(error) })
      return this.fallback.generate(params)
    }
  }

  private async emitFiscal(params: ReceiptParams): Promise<ReceiptResult> {
    const numeroNf = await queueConnection.incr(NFCE_NUMERO_SEQUENCE_KEY)
    const config = this.buildConfig(numeroNf)
    const items = this.buildItems(params)
    const payments = this.buildPayments(params)

    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: params.shortCode,
      config,
      items,
      payments,
      totalAmount: params.totalInCents / 100,
      discountAmount: 0,
    })

    if (!result.success || !result.cupomPdf) {
      throw new Error(`fiscal_emit_rejected: ${result.errorCode ?? 'unknown'} ${result.errorMessage ?? ''} ${result.errorHint ?? ''}`.trim())
    }

    return {
      pdf: Buffer.from(result.cupomPdf.base64, 'base64'),
      fiscalDocumentId: result.chaveAcesso ?? null,
    }
  }

  private buildConfig(numeroNf: number): NfceConfig {
    return {
      model: 'nfce',
      environment: environment.FISCAL_ENVIRONMENT,
      cnpj: environment.FISCAL_CNPJ!,
      inscricaoEstadual: environment.FISCAL_INSCRICAO_ESTADUAL,
      razaoSocial: environment.FISCAL_RAZAO_SOCIAL!,
      uf: environment.FISCAL_UF!,
      municipio: environment.FISCAL_MUNICIPIO!,
      codigoMunicipio: environment.FISCAL_CODIGO_MUNICIPIO!,
      cep: environment.FISCAL_CEP!,
      logradouro: environment.FISCAL_LOGRADOURO!,
      numero: environment.FISCAL_NUMERO_ENDERECO!,
      bairro: environment.FISCAL_BAIRRO!,
      crt: environment.FISCAL_CRT,
      certificadoBase64: environment.FISCAL_CERTIFICADO_BASE64!,
      certificadoSenha: environment.FISCAL_CERTIFICADO_SENHA!,
      serie: environment.FISCAL_SERIE,
      numeroNf,
      cscId: environment.FISCAL_CSC_ID!,
      cscToken: environment.FISCAL_CSC_TOKEN!,
    }
  }

  // Limitação conhecida do MVP: `products` (api-quickcart) não tem colunas de NCM/CFOP/CST
  // por item — todo o carrinho usa a classificação fiscal padrão configurada via env.
  private buildItems(params: ReceiptParams): FiscalItem[] {
    return params.items.map((item, index) => ({
      codigo: String(index + 1),
      descricao: item.productName,
      ncm: environment.FISCAL_DEFAULT_NCM,
      cfop: environment.FISCAL_DEFAULT_CFOP,
      cst: environment.FISCAL_DEFAULT_CST,
      unidade: 'UN',
      quantidade: item.quantity,
      valorUnitario: item.unitPriceInCents / 100,
      valorTotal: item.totalInCents / 100,
    }))
  }

  private buildPayments(params: ReceiptParams): FiscalPayment[] {
    const method = RECEIPT_TO_FISCAL_PAYMENT_METHOD[params.paymentMethod] ?? PaymentMethod.CASH
    return [{ method, amount: params.totalInCents / 100 }]
  }
}
