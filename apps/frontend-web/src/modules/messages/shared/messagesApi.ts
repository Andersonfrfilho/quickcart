/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { TranscriptionMode } from '@adatechnology/conversations-ui'
import { adminRequest } from '@/modules/admin/shared/adminRequest'

export type WhatsAppSettings = {
  readonly templateName: string
  readonly templateLanguage: string
  readonly templateVariables: readonly string[]
  readonly welcomeMessage: string
  readonly farewellMessage: string
  /**
   * `null` = "não decidido no painel", e aí vale o padrão da instalação. Distinto de `false`, que é
   * decisão explícita de desligar para esta empresa.
   */
  readonly transcriptionEnabled: boolean | null
  readonly transcriptionMode: TranscriptionMode | null
  /**
   * Somente leitura, vem do servidor: o ambiente TEM engine e credencial de transcrição?
   *
   * Diferente de `transcriptionEnabled` ("esta empresa quer"). Não é enviado no save — o painel não
   * decide capacidade.
   */
  readonly transcriptionAvailable?: boolean
  /**
   * Somente leitura: está valendo AGORA para esta empresa, com a política já resolvida no servidor
   * (capacidade + escolha do painel + padrão da instalação).
   *
   * É isto que a inbox consulta para desenhar (ou não) o botão "transcrever" — resolver no cliente
   * exigiria conhecer o padrão do deploy, que ele não conhece.
   */
  readonly transcriptionActive?: boolean
}

export const messagesApi = {
  getSettings: (): Promise<WhatsAppSettings> => adminRequest<WhatsAppSettings>('/whatsapp/settings'),

  saveSettings: (settings: WhatsAppSettings): Promise<void> =>
    adminRequest<void>('/whatsapp/settings', { method: 'PUT', body: JSON.stringify(settings) }),
}
