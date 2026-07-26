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
  PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ── WhatsApp (Meta Cloud API) ──
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(''),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().default(''),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_BASE_URL: z.string().default('https://graph.facebook.com'),
  // O meta-whatsapp-module é multiempresa por construção; o QuickCart atende uma loja só.
  // Este UUID fixo é o tenant único — existe para satisfazer a chave do módulo, não porque
  // haja mais de um inquilino. Vira configurável no dia em que houver.
  WHATSAPP_COMPANY_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),

  // ── STT/LLM (opcional) ──
  GROQ_API_KEY: z.string().optional(),

  // ── Nota fiscal (opcional) ──
  FISCAL_ENABLED: booleanFromString('false'),

  // ── E-mail (opcional) ──
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  // ── Tokens internos ──
  ADMIN_API_TOKEN: z.string().min(1),
  INTERNAL_API_TOKEN: z.string().min(1),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5183'),

  // ── Observabilidade ──
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ── Loja (usado no recibo/nota — Fase 7) ──
  STORE_NAME: z.string().default('QuickCart'),
  STORE_CNPJ: z.string().optional(),
  STORE_ADDRESS: z.string().optional(),
})

export const environment = environmentSchema.parse(process.env)

export function getAllowedOrigins(): string[] {
  return environment.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
}

export function isEmailFeatureEnabled(): boolean {
  return Boolean(environment.SMTP_HOST && environment.SMTP_USER && environment.SMTP_PASS)
}
