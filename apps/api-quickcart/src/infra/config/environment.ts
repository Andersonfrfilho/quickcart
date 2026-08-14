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

export const environmentSchema = z.object({
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
  // Leitura do transcript pelo simulador, sem sessão de admin. Fica FALSO por padrão: só o ambiente
  // local liga, e staging/produção não definem a variável.
  //
  // `booleanFromString` e não `z.coerce.boolean()`: coerção é `Boolean(valor)`, então a string
  // "false" ligaria a flag — desligar a mão abriria as rotas de preview em vez de fechá-las.
  PREVIEW_TRANSCRIPT_ENABLED: booleanFromString('false'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_BASE_URL: z.string().default('https://graph.facebook.com'),
  // O meta-whatsapp-module é multiempresa por construção; o QuickCart atende uma loja só.
  // Este UUID fixo é o tenant único — existe para satisfazer a chave do módulo, não porque
  // haja mais de um inquilino. Vira configurável no dia em que houver.
  WHATSAPP_COMPANY_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
  /**
   * Chave do HMAC da lista de supressão de notificações. A lista guarda hash, nunca o endereço em
   * claro — ela existe para não enviar, não para virar cadastro de contatos (`security.md` §1).
   */
  NOTIFICATION_SUPPRESSION_KEY: z.string().min(32),
  /**
   * Ausente, o canal de e-mail não é montado — e o fan-out simplesmente não o planeja. Melhor que
   * montar um driver que falha em toda tentativa e enche a tabela de `deliveries` de erro.
   */
  NOTIFICATION_SMTP_URL: z.string().optional(),
  NOTIFICATION_EMAIL_FROM: z.string().email().default('nao-responda@quickcart.local'),

  // ── Moderação de conteúdo ──
  // Desligada por padrão: marcar mensagem de cliente é decisão de operação, não default técnico.
  MODERATION_ENABLED: booleanFromString('false'),
  // Termos além do núcleo pt-BR do pacote, separados por vírgula. É o escape para o que o
  // dicionário não cobre no vocabulário do próprio negócio.
  MODERATION_EXTRA_TERMS: z.string().default(''),
  // Resgata falso positivo sem editar o pacote — ex.: termo que é nome de produto do catálogo.
  MODERATION_ALLOWED_TERMS: z.string().default(''),

  // ── Transcrição de áudio (nota de voz → texto) ──
  // Desligada por padrão: transcrever consome cota de engine externo, e ligar isso sem alguém
  // decidir seria gastar em silêncio.
  TRANSCRIPTION_ENABLED: booleanFromString('false'),
  // `onDemand`: só transcreve quando o atendente clica — gasta cota apenas com áudio que alguém vai
  // ler. `auto`: transcreve toda nota de voz na ingestão, onde o buffer já está em memória.
  TRANSCRIPTION_MODE: z.enum(['auto', 'onDemand']).default('onDemand'),
  // Free tier do Groq cobre ~2h de áudio/hora e 8h/dia. Passar disso custa US$0,04 por hora.
  TRANSCRIPTION_GROQ_API_KEY: z.string().default(''),
  TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3-turbo'),
  // Informar o idioma corta a etapa de detecção do Whisper e evita pt-BR curto virar espanhol.
  TRANSCRIPTION_LANGUAGE: z.string().default('pt'),
  /**
   * Engine local como reserva, para o dia em que depender de serviço externo deixar de servir.
   * Desligado, a imagem do worker não precisa de ffmpeg nem do binário do whisper.cpp — ver o
   * README de @adatechnology/audio-transcription-provider.
   */
  TRANSCRIPTION_LOCAL_FALLBACK_ENABLED: booleanFromString('false'),
  TRANSCRIPTION_LOCAL_MODEL_PATH: z.string().default('/models/ggml-small.bin'),

  // ── Object storage (arquivos da conversa) ──
  // Desligado, a ingestão não é enfileirada e a biblioteca fica vazia — sem meio erro em runtime.
  STORAGE_ENABLED: booleanFromString('false'),
  STORAGE_ENDPOINT: z.string().url().default('http://localhost:9564'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_BUCKET: z.string().default('quickcart-documents'),
  STORAGE_ACCESS_KEY_ID: z.string().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
  // MinIO exige path-style; bucket gerenciado normalmente aceita virtual-host.
  STORAGE_FORCE_PATH_STYLE: booleanFromString('true'),
  STORAGE_MAX_OBJECT_SIZE_BYTES: z.coerce.number().int().positive().default(26_214_400),
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  // Teto do zip em lote, em bytes de ARQUIVO — não de memória.
  //
  // Medido: 40 MB de anexos levaram o RSS de 43 MB para 325 MB, ~7× o payload, porque o binário
  // coexiste três vezes (buffer lido, cópia no jszip, saída comprimida). Os 20 MB padrão portanto
  // custam ~140 MB de pico; combinado com MAX_CONCURRENT_ARCHIVES=1, é o que mantém o processo de
  // pé num container pequeno. Subir isto sem subir a memória do container é como o serviço morre.
  DOCUMENTS_ARCHIVE_MAX_BYTES: z.coerce.number().int().positive().default(20_971_520),

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

  /*
   * ── Distância e previsão de chegada ──
   *
   * `STORE_CEP` é o interruptor da feature: sem ele não há de onde medir, e a tela mostra endereço sem
   * distância. Opcional de propósito — uma loja que não configurou não deve deixar de subir por isso.
   *
   * Os três números são estimativas grosseiras, e estão em env justamente porque precisam ser
   * calibrados com entrega real (spec §4.4) sem exigir deploy de código.
   */
  STORE_CEP: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'STORE_CEP precisa ter 8 dígitos')
    .optional(),
  /** Haversine é linha reta e subestima percurso urbano. 1.35 é ponto de partida da literatura, não medição desta operação. */
  DISTANCE_DETOUR_FACTOR: z.coerce.number().positive().default(1.35),
  DELIVERY_AVERAGE_SPEED_KMH: z.coerce.number().positive().default(25),
  STORE_PREPARATION_MINUTES: z.coerce.number().nonnegative().default(20),
  /** Alimenta um AVISO ao operador, nunca uma trava na venda (spec §8 Q2) — a coordenada vem de CEP e erra. */
  STORE_DELIVERY_RADIUS_KM: z.coerce.number().positive().default(8),
  /**
   * Quanto tempo esperar antes de cobrar UMA vez a decisão sobre item em falta.
   *
   * Duas horas por padrão: menos que isso cobra quem está no trabalho e ainda vai responder no almoço;
   * muito mais e a sacola fica parada no balcão a tarde inteira antes de alguém da loja perceber.
   */
  CUSTOMER_DECISION_REMINDER_HOURS: z.coerce.number().positive().default(2),
})

export const environment = environmentSchema.parse(process.env)

export function getAllowedOrigins(): string[] {
  return environment.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
}

export function isEmailFeatureEnabled(): boolean {
  return Boolean(environment.SMTP_HOST && environment.SMTP_USER && environment.SMTP_PASS)
}
