/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Toda a lógica da tela de configuração, fora do componente (`web.md` §4).
 *
 * O SDK entrega leitura, escrita e cache; o que sobra aqui é o que o SDK não pode saber: quais
 * canais este produto oferece, e que o template selecionado precisa cair de volta na lista quando a
 * escrita cria uma versão nova.
 */

import { useMemo, useState } from 'react'
import { renderTemplate } from '@adatechnology/notification-contracts'
import type { NotificationPreference, NotificationTemplate } from '@adatechnology/notification-contracts'
import { usePreferences, useTemplates, useUpdatePreferences, useUpsertTemplate } from '@adatechnology/notification-ui/headless'

import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  TEMPLATE_PREVIEW_PAYLOAD,
  type NotificationChannelId,
} from '@/modules/notifications/shared/notificationSettings.constant'

export type TemplateDraft = {
  readonly key: string
  readonly channel: string
  readonly locale: string
  readonly subject: string
  readonly body: string
  readonly whatsappTemplateName: string
}

function toDraft(template: NotificationTemplate): TemplateDraft {
  return {
    key: template.key,
    channel: template.channel,
    locale: template.locale,
    subject: template.subject ?? '',
    body: template.body,
    whatsappTemplateName: template.whatsappTemplateName ?? '',
  }
}

export function useNotificationSettings() {
  const preferencesQuery = usePreferences()
  const templatesQuery = useTemplates()
  const updatePreferences = useUpdatePreferences()
  const upsertTemplate = useUpsertTemplate()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState<TemplateDraft | undefined>(undefined)

  /**
   * Só a versão ATIVA mais alta por `key`+`channel`+`locale`.
   *
   * A rota devolve o histórico inteiro — correto para auditoria, e é o que o módulo grava. Mas na
   * tela isso fazia a mesma mensagem aparecer três vezes, e quem configura não tem como saber qual
   * está no ar. O envio usa `findActive`, que é exatamente esta escolha; a tela passa a mostrar o
   * mesmo que o cliente recebe.
   *
   * Filtrado aqui e não no pacote de propósito: o histórico é dado legítimo, e esconder no servidor
   * tiraria de quem quiser auditar.
   */
  const templates = useMemo(() => {
    const activeByKey = new Map<string, NotificationTemplate>()
    for (const template of templatesQuery.data ?? []) {
      if (!template.active) continue
      const identity = `${template.key}:${template.channel}:${template.locale}`
      const current = activeByKey.get(identity)
      if (!current || template.version > current.version) activeByKey.set(identity, template)
    }
    return [...activeByKey.values()].sort((left, right) => left.key.localeCompare(right.key) || left.channel.localeCompare(right.channel))
  }, [templatesQuery.data])

  /**
   * O selecionado é derivado do id, não guardado como objeto.
   *
   * Guardando o objeto, salvar criaria uma versão nova no servidor e a tela continuaria segurando a
   * anterior — o editor mostraria a versão que já não é a ativa, e a próxima gravação sobrescreveria
   * a partir de um texto velho.
   */
  const selected = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  )

  /**
   * Preferência por categoria e canal, a partir das linhas que existem.
   *
   * Ausência é o estado inicial normal — o módulo devolve só o que foi gravado, e não inventa linha
   * para categoria que ninguém configurou. `true` como default é deliberado: o comportamento de
   * fábrica é avisar, e um cliente que não recebeu nada porque a linha não existia seria pior que um
   * que recebeu demais.
   */
  const enabledChannels = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const category of NOTIFICATION_CATEGORIES) {
      for (const channel of NOTIFICATION_CHANNELS) {
        const row = (preferencesQuery.data ?? []).find(
          (preference) => preference.category === category.id && preference.channel === channel.id,
        )
        map.set(`${category.id}:${channel.id}`, row?.enabled ?? true)
      }
    }
    return map
  }, [preferencesQuery.data])

  function isChannelEnabled(params: { category: string; channel: NotificationChannelId }): boolean {
    return enabledChannels.get(`${params.category}:${params.channel}`) ?? true
  }

  function toggleChannel(params: { category: string; channel: NotificationChannelId }): void {
    const next: NotificationPreference[] = []
    for (const category of NOTIFICATION_CATEGORIES) {
      for (const channel of NOTIFICATION_CHANNELS) {
        const isTarget = category.id === params.category && channel.id === params.channel
        const current = isChannelEnabled({ category: category.id, channel: channel.id })
        next.push({
          category: category.id,
          // O canal do contracts é união literal; a constante daqui é `as const`, então o cast é
          // estreitamento e não invenção — os ids são os mesmos quatro.
          channel: channel.id as NotificationPreference['channel'],
          enabled: isTarget ? !current : current,
        })
      }
    }
    // Manda o conjunto inteiro: a rota é `PUT` em lote, e enviar só o que mudou apagaria o resto.
    updatePreferences.mutate(next)
  }

  function selectTemplate(template: NotificationTemplate): void {
    setSelectedTemplateId(template.id)
    setDraft(toDraft(template))
  }

  function updateDraft(patch: Partial<TemplateDraft>): void {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  /**
   * O MESMO render do envio, importado do contracts. Reimplementar a interpolação aqui daria um
   * preview que confere hoje e mente quando o renderer mudar.
   */
  const preview = useMemo(() => {
    if (!draft) return undefined
    return renderTemplate({
      channel: draft.channel,
      subject: draft.subject || undefined,
      body: draft.body,
      payload: TEMPLATE_PREVIEW_PAYLOAD,
    })
  }, [draft])

  const isDirty = useMemo(() => {
    if (!draft || !selected) return false
    const original = toDraft(selected)
    return (Object.keys(original) as (keyof TemplateDraft)[]).some((field) => original[field] !== draft[field])
  }, [draft, selected])

  function saveDraft(): void {
    if (!draft) return
    upsertTemplate.mutate(
      {
        key: draft.key,
        // Mesmo estreitamento do `toggleChannel`: o rascunho guarda o canal como string porque veio
        // do template lido, e o corpo da rota pede a união literal.
        channel: draft.channel as NotificationPreference['channel'],
        locale: draft.locale,
        active: true,
        body: draft.body,
        // Campo vazio é ausência, não string vazia: gravar `''` faria o renderer tratar como subject
        // existente e derivar título vazio, em vez de cair no fallback que usa o corpo.
        ...(draft.subject ? { subject: draft.subject } : {}),
        ...(draft.whatsappTemplateName ? { whatsappTemplateName: draft.whatsappTemplateName } : {}),
      },
      {
        // A versão nova tem outro id: sem soltar a seleção, o editor ficaria preso na anterior.
        onSuccess: () => setSelectedTemplateId(undefined),
      },
    )
  }

  return {
    channels: NOTIFICATION_CHANNELS,
    categories: NOTIFICATION_CATEGORIES,
    templates,
    isLoading: preferencesQuery.isLoading || templatesQuery.isLoading,
    isSavingPreferences: updatePreferences.isPending,
    isSavingTemplate: upsertTemplate.isPending,
    templateError: upsertTemplate.error?.message,
    selected,
    draft,
    preview,
    isDirty,
    isChannelEnabled,
    toggleChannel,
    selectTemplate,
    updateDraft,
    saveDraft,
    clearSelection: () => setSelectedTemplateId(undefined),
  }
}
