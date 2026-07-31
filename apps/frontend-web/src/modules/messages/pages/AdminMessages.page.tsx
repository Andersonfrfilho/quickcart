/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mensagens do bot: saudação, despedida e o template de reengajamento usado quando a janela de
 * 24h da Meta fecha e só template pode ser enviado.
 */

import { useState } from 'react'
import '@adatechnology/conversations-ui/styles.css'
import {
  TranscriptionSettingsForm,
  WelcomeFarewellForm,
  WhatsAppTemplatesSettings,
} from '@adatechnology/conversations-ui'
import { useWhatsAppSettings } from '@/modules/messages/hooks/useWhatsAppSettings.hook'

const TAB = { BOT: 'bot', TEMPLATES: 'templates', TRANSCRIPTION: 'transcription' } as const
type Tab = (typeof TAB)[keyof typeof TAB]

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
  const { settings, loading, saving, saveSuccess, failure, update, save } = useWhatsAppSettings()
  const [tab, setTab] = useState<Tab>(TAB.BOT)

  if (loading) return <p className="p-6 text-sm text-gray-500">Carregando configurações…</p>

  return (
    /* Tinha `p-6` próprio somado ao `p-6` do shell — 48px de borda no desktop. Agora o shell cuida
       do desktop e a página só põe o respiro do celular. */
    <div className="space-y-6 p-4 lg:p-0">
      <header>
        <h1 className="text-xl font-semibold">Mensagens</h1>
        <p className="text-sm text-gray-500">Mensagens do bot e templates do WhatsApp.</p>
      </header>

      <nav className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab(TAB.BOT)}
          className={`px-3 py-2 text-sm ${tab === TAB.BOT ? 'border-b-2 border-primary font-medium' : 'text-gray-500'}`}
        >
          Mensagens do Bot
        </button>
        <button
          type="button"
          onClick={() => setTab(TAB.TEMPLATES)}
          className={`px-3 py-2 text-sm ${tab === TAB.TEMPLATES ? 'border-b-2 border-primary font-medium' : 'text-gray-500'}`}
        >
          Templates WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setTab(TAB.TRANSCRIPTION)}
          className={`px-3 py-2 text-sm ${tab === TAB.TRANSCRIPTION ? 'border-b-2 border-primary font-medium' : 'text-gray-500'}`}
        >
          Transcrição de áudio
        </button>
      </nav>

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {failure}
        </p>
      ) : null}

      {tab === TAB.TRANSCRIPTION ? (
        <TranscriptionSettingsForm
          enabled={settings.transcriptionEnabled ?? UNDECIDED_ENABLED}
          onEnabledChange={(transcriptionEnabled) => update({ transcriptionEnabled })}
          mode={settings.transcriptionMode ?? UNDECIDED_MODE}
          onModeChange={(transcriptionMode) => update({ transcriptionMode })}
          onSave={save}
          isAvailable={settings.transcriptionAvailable ?? false}
          saving={saving}
          saveSuccess={saveSuccess}
        />
      ) : tab === TAB.BOT ? (
        <WelcomeFarewellForm
          welcomeMessage={settings.welcomeMessage}
          onWelcomeMessageChange={(welcomeMessage) => update({ welcomeMessage })}
          farewellMessage={settings.farewellMessage}
          onFarewellMessageChange={(farewellMessage) => update({ farewellMessage })}
          onSave={save}
          saving={saving}
          saveSuccess={saveSuccess}
        />
      ) : (
        <>
          {/* A lista de templates vem da Graph API da Meta e o QuickCart ainda não tem rota que a
              consulte — sem isso o seletor abre vazio. O formulário já salva a escolha, então o
              que falta é só a origem dos dados. */}
          <p className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            A listagem de templates aprovados exige uma rota que consulte a Graph API da Meta, ainda
            não implementada no QuickCart. O seletor abaixo salva a escolha, mas nasce vazio.
          </p>
          {/* Sem `create`: criar template exige rota que fale com a Graph API, que o QuickCart ainda
              não tem — o submenu esconde a aba em vez de oferecer formulário sem destino. */}
          <WhatsAppTemplatesSettings
            templates={[]}
            selectedTemplateName={settings.templateName}
            onSelectTemplate={(templateName) => update({ templateName })}
            variables={[...settings.templateVariables]}
            onVariablesChange={(templateVariables) => update({ templateVariables })}
            onSave={save}
            saving={saving}
            saveSuccess={saveSuccess}
          />
        </>
      )}
    </div>
  )
}
