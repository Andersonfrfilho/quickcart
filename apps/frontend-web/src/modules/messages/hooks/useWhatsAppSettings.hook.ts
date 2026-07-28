/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { messagesApi, type WhatsAppSettings } from '@/modules/messages/shared/messagesApi'

const EMPTY_SETTINGS: WhatsAppSettings = {
  templateName: '',
  templateLanguage: 'pt_BR',
  templateVariables: [],
  welcomeMessage: '',
  farewellMessage: '',
}

// Some sozinho depois de confirmar o salvamento; sem isso o "salvo" fica na tela para sempre e
// deixa de significar "acabou de salvar".
const SAVE_FEEDBACK_MS = 2500

export type UseWhatsAppSettingsResult = {
  readonly settings: WhatsAppSettings
  readonly loading: boolean
  readonly saving: boolean
  readonly saveSuccess: boolean
  readonly failure: string | undefined
  update(partial: Partial<WhatsAppSettings>): void
  save(event: FormEvent): void
}

export function useWhatsAppSettings(): UseWhatsAppSettingsResult {
  const [settings, setSettings] = useState<WhatsAppSettings>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  useEffect(() => {
    let active = true

    messagesApi
      .getSettings()
      .then((loaded) => {
        if (active) setSettings(loaded)
      })
      .catch((error: unknown) => {
        if (active) setFailure(error instanceof Error ? error.message : 'Falha ao carregar as configurações.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!saveSuccess) return

    const timer = setTimeout(() => setSaveSuccess(false), SAVE_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [saveSuccess])

  const update = useCallback((partial: Partial<WhatsAppSettings>): void => {
    setSettings((current) => ({ ...current, ...partial }))
  }, [])

  const save = useCallback(
    (event: FormEvent): void => {
      event.preventDefault()
      setSaving(true)
      setFailure(undefined)

      messagesApi
        .saveSettings(settings)
        .then(() => setSaveSuccess(true))
        .catch((error: unknown) => {
          setFailure(error instanceof Error ? error.message : 'Falha ao salvar as configurações.')
        })
        .finally(() => setSaving(false))
    },
    [settings],
  )

  return { settings, loading, saving, saveSuccess, failure, update, save }
}
