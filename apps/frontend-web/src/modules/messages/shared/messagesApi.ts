/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { adminRequest } from '@/modules/admin/shared/adminRequest'

export type WhatsAppSettings = {
  readonly templateName: string
  readonly templateLanguage: string
  readonly templateVariables: readonly string[]
  readonly welcomeMessage: string
  readonly farewellMessage: string
}

export const messagesApi = {
  getSettings: (): Promise<WhatsAppSettings> => adminRequest<WhatsAppSettings>('/whatsapp/settings'),

  saveSettings: (settings: WhatsAppSettings): Promise<void> =>
    adminRequest<void>('/whatsapp/settings', { method: 'PUT', body: JSON.stringify(settings) }),
}
