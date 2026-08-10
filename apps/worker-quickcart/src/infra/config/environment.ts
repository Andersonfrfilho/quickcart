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
  /**
   * Mesma chave da API — o hash de supressão tem de casar entre os dois processos, senão a API
   * grava a supressão sob um hash e o worker consulta outro, e um endereço suprimido volta a
   * receber.
   */
  NOTIFICATION_SUPPRESSION_KEY: z.string().min(32),
  /**
   * Ausente, o canal de e-mail não é montado — e o fan-out simplesmente não o planeja. Melhor que
   * montar um driver que falha em toda tentativa e enche a tabela de `deliveries` de erro.
   */
  NOTIFICATION_SMTP_URL: z.string().optional(),
  NOTIFICATION_EMAIL_FROM: z.string().email().default('nao-responda@quickcart.local'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_BASE_URL: z.string().default('https://graph.facebook.com'),
  // Tenant único do QuickCart, igual ao da api-quickcart — a retenção varre por empresa.
  WHATSAPP_COMPANY_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),

  // ── Object storage (arquivos da conversa) ──
  // Espelha o schema da api-quickcart: processos separados, mesmas variáveis. O worker é quem
  // efetivamente grava o binário, então sem isto a fila `documents` não tem para onde copiar.
  STORAGE_ENABLED: booleanFromString('false'),
  STORAGE_ENDPOINT: z.string().url().default('http://localhost:9564'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_BUCKET: z.string().default('quickcart-documents'),
  STORAGE_ACCESS_KEY_ID: z.string().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
  STORAGE_FORCE_PATH_STYLE: booleanFromString('true'),
  STORAGE_MAX_OBJECT_SIZE_BYTES: z.coerce.number().int().positive().default(26_214_400),
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // Retenção dos arquivos da conversa. `0` desliga: a política de dado pessoal é decisão do
  // negócio, e apagar por padrão seria destruir dado de quem nunca pediu isso.
  DOCUMENTS_RETENTION_DAYS: z.coerce.number().int().min(0).default(0),
  // Intervalo da varredura, em horas.
  DOCUMENTS_RETENTION_SWEEP_HOURS: z.coerce.number().int().positive().default(24),
  // Teto por execução, para o job não segurar conexão e storage indefinidamente.
  DOCUMENTS_RETENTION_BATCH_SIZE: z.coerce.number().int().positive().default(200),

  // ── STT (Groq, opcional) ──
  // Serve ao STT efêmero que devolve a fala ao motor de conversa (fila `stt`).
  GROQ_API_KEY: z.string().optional(),

  // ── Transcrição de nota de voz (persistida, exibida na inbox) ──
  // Espelha o schema da api-quickcart: processos separados, mesmas variáveis. Diferente do STT
  // acima, esta transcrição é GRAVADA na mensagem e o atendente a lê e copia no painel.
  TRANSCRIPTION_ENABLED: booleanFromString('false'),
  TRANSCRIPTION_MODE: z.enum(['auto', 'onDemand']).default('onDemand'),
  TRANSCRIPTION_GROQ_API_KEY: z.string().default(''),
  TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3-turbo'),
  TRANSCRIPTION_LANGUAGE: z.string().default('pt'),
  // Ligado, a imagem do worker precisa de ffmpeg + binário do whisper.cpp + modelo — ver o README
  // de @adatechnology/audio-transcription-provider.
  TRANSCRIPTION_LOCAL_FALLBACK_ENABLED: booleanFromString('false'),
  TRANSCRIPTION_LOCAL_MODEL_PATH: z.string().default('/models/ggml-small.bin'),

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
  //
  // Sem default: o painel sobe sempre, e credencial vazia vira `basicAuth({ users: { '': '' } })`,
  // que autentica requisição sem credencial nenhuma — as filas ficam abertas a quem achar a porta.
  // `security.md` §2 exige falhar no boot em vez disso.
  BULL_BOARD_PORT: z.coerce.number().int().positive().default(3010),
  BULL_BOARD_USER: z.string().min(1),
  BULL_BOARD_PASSWORD: z.string().min(1),

  // ── Observabilidade ──
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const environment = environmentSchema.parse(process.env)

export function isEmailFeatureEnabled(): boolean {
  return Boolean(environment.SMTP_HOST && environment.SMTP_USER && environment.SMTP_PASS)
}
