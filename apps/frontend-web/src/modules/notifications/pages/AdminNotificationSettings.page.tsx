/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Consome a tela COMPOSTA. Esta página tinha 221 linhas mais 207 de hook, todas reimplementando
 * layout, lista de versões e editor — o que a página de Documentos resolve em 35, porque consome
 * workspace.
 *
 * O que resta aqui é só o que o pacote não pode saber: quais canais esta loja usa, quais assuntos ela
 * dispara, o exemplo do preview, e o campo do template aprovado na Meta.
 */

import { NotificationSettingsWorkspace } from '@adatechnology/notification-ui'
import type { NotificationTemplate } from '@adatechnology/notification-contracts'

import { Input } from '@/components/ui'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  ORDER_STATUS_LABEL,
  TEMPLATE_PREVIEW_PAYLOAD,
} from '@/modules/notifications/shared/notificationSettings.constant'

/** `order.status.preparing` → "Em separação", que é como o lojista pensa na mensagem. */
function templateLabelOf(template: NotificationTemplate): string {
  return ORDER_STATUS_LABEL[template.key.replace('order.status.', '')] ?? template.key
}

export function AdminNotificationSettingsPage() {
  return (
    <div className="p-4 lg:p-6">
      <NotificationSettingsWorkspace
        channels={NOTIFICATION_CHANNELS}
        categories={NOTIFICATION_CATEGORIES}
        previewPayload={TEMPLATE_PREVIEW_PAYLOAD}
        templateLabelOf={templateLabelOf}
        /* Slot: o nome do template aprovado só existe no WhatsApp, e o pacote não deve saber disso. */
        renderChannelFields={({ channel, value, onChange }) =>
          channel === 'whatsapp' ? (
            <label className="mt-3 block">
              <span className="text-sm font-medium">Template aprovado na Meta</span>
              <span className="block text-xs text-muted-foreground">
                Sem isto o WhatsApp é pulado: fora da janela de 24h a Meta só aceita template aprovado.
              </span>
              <Input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1" />
            </label>
          ) : null
        }
      />
    </div>
  )
}
