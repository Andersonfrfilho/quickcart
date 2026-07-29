/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Popula conversas usando o `LogMessageUseCase` do módulo — o mesmo caminho do webhook — em vez de
 * INSERT bruto, para que sessão, transcript e estado nasçam consistentes.
 *
 * Exceção consciente: as datas são reescritas por SQL depois. O use-case carimba `now()`, e sem
 * envelhecer as conversas todas cairiam na faixa `<12h` — o filtro de janela ficaria sem nada para
 * testar, que é justamente o motivo deste seed existir.
 */

import { sql } from 'drizzle-orm'
import {
  LogMessageUseCase,
  MessageRepository,
  SessionRepository,
  type MetaWhatsAppModule,
} from '@adatechnology/meta-whatsapp-module'
import { db } from '@/infra/database/connection'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { buildConversationScenarios, HOURS_AGO_BY_BAND, type ConversationScenario } from './ConversationSeed'
import { seedMediaConversation } from './MediaConversationSeedRunner'

const log = logger.child('ConversationSeed')
// `assigned_user_id` é uuid no schema do módulo; um identificador legível seria recusado pelo banco.
// UUID fixo para que as conversas assumidas pelo seed sejam reconhecíveis e reproduzíveis.
const SEED_AGENT_USER_ID = '00000000-0000-4000-8000-00000000a9e7'
const START_STATE = 'greeting'

async function seedScenario(params: {
  readonly scenario: ConversationScenario
  readonly logMessage: LogMessageUseCase
  readonly sessionRepository: SessionRepository
}): Promise<void> {
  const { scenario, logMessage, sessionRepository } = params
  const companyId = environment.WHATSAPP_COMPANY_ID

  for (const [index, message] of scenario.messages.entries()) {
    await logMessage.execute({
      companyId,
      whatsappNumber: scenario.whatsappNumber,
      startState: START_STATE,
      direction: message.direction,
      sender: message.direction === 'inbound' ? 'customer' : scenario.mode === 'human' ? 'agent' : 'bot',
      type: 'text',
      content: message.content,
      // waMessageId é a chave de idempotência do insert: sem um valor único por mensagem, rodar o
      // seed duas vezes descartaria tudo a partir da segunda.
      waMessageId: `wamid.seed.${scenario.whatsappNumber}.${index}`,
    })
  }

  if (scenario.customerName) {
    await sessionRepository.setState(companyId, scenario.whatsappNumber, START_STATE, {
      customerName: scenario.customerName,
    })
  }

  if (scenario.mode === 'human') {
    await sessionRepository.takeover(companyId, scenario.whatsappNumber, SEED_AGENT_USER_ID)
  } else if (scenario.waitingHuman) {
    await sessionRepository.requestHuman(companyId, scenario.whatsappNumber)
  }
}

async function ageConversation(whatsappNumber: string, hoursAgo: number): Promise<void> {
  const interval = sql.raw(`interval '${hoursAgo} hours'`)

  await db.execute(sql`
    update meta_whatsapp.sessions
       set last_inbound_at = now() - ${interval},
           last_activity   = now() - ${interval},
           updated_at      = now() - ${interval}
     where whatsapp_number = ${whatsappNumber}
  `)

  // A coluna é `created_at`; a API a expõe como `sentAt` no envelope de resposta.
  await db.execute(sql`
    update meta_whatsapp.messages
       set created_at = now() - ${interval}
     where whatsapp_number = ${whatsappNumber}
  `)
}

export async function seedConversations(metaWhatsApp: MetaWhatsAppModule): Promise<void> {
  const sessionRepository = new SessionRepository(db)
  const messageRepository = new MessageRepository(db)
  const logMessage = new LogMessageUseCase(sessionRepository, messageRepository)

  const scenarios = buildConversationScenarios()

  for (const scenario of scenarios) {
    await seedScenario({ scenario, logMessage, sessionRepository })
    await ageConversation(scenario.whatsappNumber, HOURS_AGO_BY_BAND[scenario.band])
  }

  // Contato com um arquivo de cada tipo aceito — substitui a antiga tela de "teste de mídia":
  // inspeciona-se pela inbox, como qualquer cliente.
  await seedMediaConversation(metaWhatsApp)

  log.info('conversations_seeded', {
    total: scenarios.length,
    human: scenarios.filter((scenario) => scenario.mode === 'human').length,
    waiting: scenarios.filter((scenario) => scenario.waitingHuman).length,
    named: scenarios.filter((scenario) => scenario.customerName).length,
  })
}
