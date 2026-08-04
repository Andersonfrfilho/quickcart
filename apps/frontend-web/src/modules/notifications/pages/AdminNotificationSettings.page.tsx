/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Configuração de notificações: por onde avisar, e o que o cliente lê.
 *
 * Declarativa, sem lógica — tudo vem do `useNotificationSettings`. O preview usa o MESMO
 * `renderTemplate` do envio, então o que aparece aqui é o que chega ao cliente.
 */

import { Button, Card, Input } from '@/components/ui'
import { useNotificationSettings } from '@/modules/notifications/hooks/useNotificationSettings.hook'
import { ORDER_STATUS_LABEL } from '@/modules/notifications/shared/notificationSettings.constant'

/** `order.status.preparing` → "Em separação", que é como o lojista pensa no template. */
function templateLabel(key: string): string {
  const status = key.replace('order.status.', '')
  return ORDER_STATUS_LABEL[status] ?? key
}

const CHANNEL_BADGE: Record<string, string> = {
  inbox: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  whatsapp: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  email: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  push: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
}

export function AdminNotificationSettingsPage() {
  const settings = useNotificationSettings()

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 lg:space-y-6 lg:p-6">
      <header>
        <h1 className="text-xl font-semibold">Configurações de notificação</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Por onde o cliente é avisado, e o texto exato que ele recebe.
        </p>
      </header>

      <Card className="p-4 lg:p-5">
        <h2 className="font-medium">Canais</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Desligar um canal não apaga o histórico — o aviso deixa de sair por ali a partir do próximo pedido.
        </p>

        <div className="mt-4 space-y-5">
          {settings.categories.map((category) => (
            <div key={category.id}>
              <p className="text-sm font-medium">{category.label}</p>
              <p className="text-xs text-muted-foreground">{category.hint}</p>

              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {settings.channels.map((channel) => {
                  const enabled = settings.isChannelEnabled({ category: category.id, channel: channel.id })
                  return (
                    <label
                      key={channel.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 hover:bg-accent"
                    >
                      {/* Área de toque mínima em mobile (`web.md` §10): o input nativo mede 13px. */}
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={settings.isSavingPreferences}
                        onChange={() => settings.toggleChannel({ category: category.id, channel: channel.id })}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{channel.label}</span>
                        <span className="block text-xs text-muted-foreground">{channel.hint}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-2">
          <div className="border-b border-border p-4">
            <h2 className="font-medium">Mensagens</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Uma versão nova é criada a cada gravação; a anterior fica no histórico.
            </p>
          </div>

          {settings.isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}

          {!settings.isLoading && settings.templates.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhuma mensagem cadastrada. Elas são criadas no primeiro boot da api.
            </p>
          )}

          <ul className="divide-y divide-border">
            {settings.templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => settings.selectTemplate(template)}
                  className={`flex w-full items-center gap-2 p-3 text-left hover:bg-accent ${
                    settings.selected?.id === template.id ? 'bg-accent' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{templateLabel(template.key)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{template.body}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      CHANNEL_BADGE[template.channel] ?? 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {template.channel}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">v{template.version}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 lg:col-span-3 lg:p-5">
          {!settings.draft && (
            <p className="text-sm text-muted-foreground">Escolha uma mensagem à esquerda para editar.</p>
          )}

          {settings.draft && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{templateLabel(settings.draft.key)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {settings.draft.channel} · {settings.draft.locale} · v{settings.selected?.version}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={settings.clearSelection}>
                  Fechar
                </Button>
              </div>

              <label className="block">
                <span className="text-sm font-medium">Título</span>
                <span className="block text-xs text-muted-foreground">
                  O que aparece na lista. Vazio, o título é derivado da primeira linha do texto.
                </span>
                <Input
                  value={settings.draft.subject}
                  onChange={(event) => settings.updateDraft({ subject: event.target.value })}
                  className="mt-1"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Texto</span>
                <span className="block text-xs text-muted-foreground">
                  Use <code className="rounded bg-muted px-1">{'{{shortCode}}'}</code> para o número do pedido.
                </span>
                <textarea
                  value={settings.draft.body}
                  onChange={(event) => settings.updateDraft({ body: event.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                />
              </label>

              {settings.draft.channel === 'whatsapp' && (
                <label className="block">
                  <span className="text-sm font-medium">Template aprovado na Meta</span>
                  <span className="block text-xs text-muted-foreground">
                    Sem isto, o WhatsApp é pulado: fora da janela de 24h a Meta só aceita template aprovado.
                  </span>
                  <Input
                    value={settings.draft.whatsappTemplateName}
                    onChange={(event) => settings.updateDraft({ whatsappTemplateName: event.target.value })}
                    className="mt-1"
                  />
                </label>
              )}

              {/*
                Preview com o MESMO `renderTemplate` do envio, importado do contracts. Preview que
                reimplementa a interpolação confere hoje e mente quando o renderer mudar — e alguém
                salva confiando nele.
              */}
              {settings.preview && (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Como o cliente vê
                  </p>
                  <p className="mt-1.5 text-sm font-medium">{settings.preview.title}</p>
                  <p className="whitespace-pre-wrap text-sm">{settings.preview.body}</p>
                </div>
              )}

              {settings.templateError && (
                <p className="text-sm font-medium text-destructive">{settings.templateError}</p>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={settings.saveDraft} disabled={!settings.isDirty || settings.isSavingTemplate}>
                  {settings.isSavingTemplate ? 'Salvando…' : 'Salvar nova versão'}
                </Button>
                {/* Diz por que está desabilitado, em vez de deixar o botão inerte sem explicação. */}
                {!settings.isDirty && <span className="text-xs text-muted-foreground">Nada mudou ainda.</span>}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
