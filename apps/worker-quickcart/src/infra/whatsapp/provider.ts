/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Instância própria do worker — mesmas credenciais da api-quickcart, mas processos separados
 * não compartilham a instância em memória. Espelha o shape usado em
 * apps/api-quickcart/src/modules/webhook/infra/whatsapp/WhatsAppSender.ts (accessToken,
 * phoneNumberId, apiVersion, baseUrl — sem catalogId/wabaId/businessId, não usados aqui).
 */

import { createWhatsAppProvider } from '@adatechnology/whatsapp-provider'
import { environment } from '@/infra/config/environment'

function isWhatsAppConfigured(): boolean {
  return Boolean(environment.WHATSAPP_ACCESS_TOKEN && environment.WHATSAPP_PHONE_NUMBER_ID)
}

export const whatsAppProvider = isWhatsAppConfigured()
  ? createWhatsAppProvider({
      accessToken: environment.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: environment.WHATSAPP_PHONE_NUMBER_ID,
      apiVersion: environment.WHATSAPP_API_VERSION,
      baseUrl: environment.WHATSAPP_BASE_URL,
    })
  : undefined
