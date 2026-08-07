/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mensagens do bot: saudação, despedida, o template de reengajamento usado quando a janela de 24h
 * da Meta fecha, e a transcrição de áudio. A tela é o `MessagesWorkspace` do pacote — aqui fica só
 * o mapeamento para a rota de configurações do QuickCart.
 */

import { useMemo, useRef } from 'react'
import '@adatechnology/conversations-ui/styles.css'
import { MessagesWorkspace, type MessagesWorkspaceApi } from '@adatechnology/conversations-ui'
import { messagesApi, type WhatsAppSettings } from '@/modules/messages/shared/messagesApi'

/**
 * Padrão da instalação quando o painel nunca decidiu.
 *
 * O servidor guarda `null` de propósito (herda o ambiente), mas o interruptor é booleano — precisa
 * mostrar alguma posição. `false` é a leitura honesta do estado "ninguém ligou aqui ainda": um
 * checkbox marcado sugeriria uma escolha que não foi feita.
 */
const UNDECIDED_ENABLED = false
const UNDECIDED_MODE = 'onDemand' as const

export function AdminMessagesPage() {
  // O QuickCart guarda tudo num único documento de configuração, e a tela salva por seção. Sem
  // guardar o último lido, salvar as boas-vindas apagaria o template (o PUT é o objeto inteiro).
  const latestSettings = useRef<WhatsAppSettings | null>(null)

  const api = useMemo<MessagesWorkspaceApi>(() => {
    async function load(): Promise<WhatsAppSettings> {
      const settings = await messagesApi.getSettings()
      latestSettings.current = settings
      return settings
    }

    async function patch(partial: Partial<WhatsAppSettings>): Promise<void> {
      const base = latestSettings.current ?? (await load())
      const next = { ...base, ...partial }
      await messagesApi.saveSettings(next)
      latestSettings.current = next
    }

    return {
      getMessages: async () => {
        const settings = await load()
        return { welcomeMessage: settings.welcomeMessage, farewellMessage: settings.farewellMessage }
      },
      saveMessages: (messages) => patch(messages),
      getTemplateSettings: async () => {
        const settings = latestSettings.current ?? (await load())
        return {
          templateName: settings.templateName,
          templateLanguage: settings.templateLanguage,
          variables: [...settings.templateVariables],
        }
      },
      saveTemplateSettings: ({ templateName, templateLanguage, variables }) =>
        patch({ templateName, templateLanguage, templateVariables: variables }),
      getTranscription: async () => {
        const settings = latestSettings.current ?? (await load())
        return {
          enabled: settings.transcriptionEnabled ?? UNDECIDED_ENABLED,
          mode: settings.transcriptionMode ?? UNDECIDED_MODE,
          available: settings.transcriptionAvailable ?? false,
        }
      },
      saveTranscription: ({ enabled, mode }) =>
        patch({ transcriptionEnabled: enabled, transcriptionMode: mode }),
    }
  }, [])

  return (
    <MessagesWorkspace
      api={api}
      // A listagem de templates aprovados exige uma rota que consulte a Graph API da Meta, ainda
      // não implementada no QuickCart — sem `listTemplates` o seletor nasce vazio, e o aviso
      // explica por quê em vez de deixar parecer defeito.
      renderTemplatesNotice={() => (
        <p className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          A listagem de templates aprovados exige uma rota que consulte a Graph API da Meta, ainda
          não implementada no QuickCart. O seletor abaixo salva a escolha, mas nasce vazio.
        </p>
      )}
    />
  )
}
