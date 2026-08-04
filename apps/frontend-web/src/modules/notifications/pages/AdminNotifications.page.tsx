/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Inbox e preferências, ambos do `@adatechnology/notification-ui`.
 *
 * A página é declarativa e não tem hook próprio (padrão do projeto): paginação infinita, cache,
 * marcação de lida e reconexão do stream vivem dentro do pacote. O que sobra aqui é layout — e é
 * exatamente esse o ponto de o pacote existir.
 */

import { NotificationList, PreferencesPanel } from '@adatechnology/notification-ui'

import { buttonVariants, Card } from '@/components/ui'
import { Link } from '@/app/router'

export function AdminNotificationsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:space-y-6 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Notificações</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O que foi avisado ao cliente, e por quais canais o painel avisa.
          </p>
        </div>
        <Link
          to="/admin/notifications/settings"
          className={`${buttonVariants({ variant: 'outline', size: 'sm' })} gap-2`}
        >
          Configurações
        </Link>
      </header>

      {/*
        Duas colunas no monitor, empilhado no celular. A inbox é a coluna larga porque é o que se lê;
        preferência se ajusta uma vez e não se olha mais.
      */}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <NotificationList className="divide-y divide-border" />
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preferências</h2>
          <PreferencesPanel className="mt-3" />
        </Card>
      </div>
    </div>
  )
}
