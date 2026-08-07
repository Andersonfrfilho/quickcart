/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cliente das rotas de template do WhatsApp. Sem cache local: a Meta é quem decide status de
 * aprovação, então cada leitura vai direto na API.
 */

import { adminRequest } from '@/modules/admin/shared/adminRequest'

export type WhatsAppTemplate = {
  readonly id: string
  readonly name: string
  readonly shortId: string
  readonly displayName: string
  readonly status: string
  readonly category: string
  readonly language: string
  readonly bodyText: string | null
  readonly variableCount: number
}

export type CreateTemplateInput = {
  readonly name: string
  readonly category: 'UTILITY' | 'MARKETING'
  readonly language: string
  readonly headerType: 'NONE' | 'TEXT'
  readonly headerText?: string
  readonly bodyText: string
  readonly footerText?: string
}

export type CreateTemplateResult = {
  readonly id: string | undefined
  readonly shortId: string
  readonly status: string
}

export const templatesApi = {
  list: (): Promise<WhatsAppTemplate[]> => adminRequest<WhatsAppTemplate[]>('/whatsapp/templates'),

  create: (input: CreateTemplateInput): Promise<CreateTemplateResult> =>
    adminRequest<CreateTemplateResult>('/whatsapp/templates', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}
