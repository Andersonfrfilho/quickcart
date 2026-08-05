/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Consome a tela COMPOSTA do pacote. A primeira versão desta página remontava o grid à mão, que é o
 * que a regra de módulos plugáveis (§4) rejeita — cada produto refazendo o layout é como as telas
 * divergiram entre sakura-bot, quickcart e financiamento antes.
 */

import { NotificationsWorkspace } from '@adatechnology/notification-ui'

export function AdminNotificationsPage() {
  return (
    <div className="p-4 lg:p-6">
      <NotificationsWorkspace settingsHref="#/admin/notifications/settings" />
    </div>
  )
}
