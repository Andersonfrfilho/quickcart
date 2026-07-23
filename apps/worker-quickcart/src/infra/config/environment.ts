/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { z } from 'zod'

const booleanFromString = (defaultValue: 'true' | 'false') =>
  z.string().default(defaultValue).transform((value) => value === 'true')

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ── API interna (rota de resume da conversa) ──
  API_BASE_URL: z.string().min(1),
  INTERNAL_API_TOKEN: z.string().min(1),

  // ── WhatsApp (Meta Cloud API) ──
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_BASE_URL: z.string().default('https://graph.facebook.com'),

  // ── STT (Groq, opcional) ──
  GROQ_API_KEY: z.string().optional(),

  // ── Nota fiscal (opcional) — @adatechnology/fiscal-provider (NFC-e) ──
  FISCAL_ENABLED: booleanFromString('false'),
  FISCAL_ENVIRONMENT: z.enum(['homologacao', 'producao']).default('homologacao'),
  FISCAL_CNPJ: z.string().optional(),
  FISCAL_INSCRICAO_ESTADUAL: z.string().default(''),
  FISCAL_RAZAO_SOCIAL: z.string().optional(),
  FISCAL_UF: z.string().optional(),
  FISCAL_MUNICIPIO: z.string().optional(),
  FISCAL_CODIGO_MUNICIPIO: z.string().optional(),
  FISCAL_CEP: z.string().optional(),
  FISCAL_LOGRADOURO: z.string().optional(),
  FISCAL_NUMERO_ENDERECO: z.string().optional(),
  FISCAL_BAIRRO: z.string().optional(),
  FISCAL_CRT: z.enum(['1', '2', '3']).default('1'),
  FISCAL_CERTIFICADO_BASE64: z.string().optional(),
  FISCAL_CERTIFICADO_SENHA: z.string().optional(),
  FISCAL_SERIE: z.string().default('1'),
  FISCAL_CSC_ID: z.string().optional(),
  FISCAL_CSC_TOKEN: z.string().optional(),
  // Classificação fiscal padrão do carrinho — MVP não tem NCM/CFOP/CST por produto
  // (schema de products em api-quickcart ainda não tem essas colunas).
  FISCAL_DEFAULT_NCM: z.string().default('22021000'),
  FISCAL_DEFAULT_CFOP: z.string().default('5102'),
  FISCAL_DEFAULT_CST: z.string().default('500'),

  // ── E-mail (opcional) ──
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  // ── Loja (recibo/nota) ──
  STORE_NAME: z.string().default('QuickCart'),
  STORE_CNPJ: z.string().optional(),
  STORE_ADDRESS: z.string().optional(),

  // ── Bull Board ──
  BULL_BOARD_PORT: z.coerce.number().int().positive().default(3010),
  BULL_BOARD_USER: z.string().default(''),
  BULL_BOARD_PASSWORD: z.string().default(''),

  // ── Observabilidade ──
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const environment = environmentSchema.parse(process.env)

export function isEmailFeatureEnabled(): boolean {
  return Boolean(environment.SMTP_HOST && environment.SMTP_USER && environment.SMTP_PASS)
}
