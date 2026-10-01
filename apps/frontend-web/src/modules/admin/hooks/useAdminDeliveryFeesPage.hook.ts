/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A tabela edita RASCUNHO (`draftTiers`), não a lista carregada — só troca de estado quando a
 * cotação de rede volta, senão cada tecla digitada disputava com o `useQuery` revalidando em
 * segundo plano.
 */

import { useEffect, useState } from 'react'
import { useRequireStaff } from '@/modules/auth/shared/useSession.hook'
import { ADMIN_ONLY } from '@/modules/auth/shared/roles.constant'
import { getApiErrorCode } from '@/shared/api/client'
import type { DeliveryFeeTier } from '@/shared/api/api.types'
import { useAdminDeliveryFeeTiersQuery } from '@/modules/admin/shared/queries/useAdminDeliveryFeeTiers.query'
import { useReplaceDeliveryFeeTiersMutation } from '@/modules/admin/shared/mutations/useReplaceDeliveryFeeTiers.mutation'
import {
  DELIVERY_FEE_TIERS_MAX_COUNT,
  parseDeliveryFeeTiersErrorMessage,
  resolveOutOfRangeWarning,
  type DeliveryFeeTiersRowErrors,
} from '@/modules/admin/shared/deliveryFeeTiers.constant'

/** Rascunho em texto: campo vazio ou "3," não pode virar `NaN` enquanto a pessoa ainda está digitando. */
export type DeliveryFeeTierDraft = {
  readonly maxDistanceKmText: string
  readonly feeInReaisText: string
}

function tierToDraft(tier: DeliveryFeeTier): DeliveryFeeTierDraft {
  return {
    maxDistanceKmText: String(tier.maxDistanceKm),
    feeInReaisText: (tier.feeInCents / 100).toFixed(2).replace('.', ','),
  }
}

function draftToTier(draft: DeliveryFeeTierDraft): DeliveryFeeTier | undefined {
  const maxDistanceKm = Number(draft.maxDistanceKmText.replace(',', '.'))
  const feeInReais = Number(draft.feeInReaisText.replace(',', '.'))
  if (!Number.isFinite(maxDistanceKm) || !Number.isFinite(feeInReais)) return undefined
  return { maxDistanceKm, feeInCents: Math.round(feeInReais * 100) }
}

export function useAdminDeliveryFeesPage() {
  const { isReady } = useRequireStaff(ADMIN_ONLY)
  const { data, isLoading } = useAdminDeliveryFeeTiersQuery()
  const replaceMutation = useReplaceDeliveryFeeTiersMutation()

  const [draftTiers, setDraftTiers] = useState<readonly DeliveryFeeTierDraft[]>([])
  const [rowErrors, setRowErrors] = useState<DeliveryFeeTiersRowErrors>(new Map())
  const [generalError, setGeneralError] = useState<string | undefined>(undefined)

  // Só substitui o rascunho quando a lista do servidor chega — nunca depois, para não apagar edição
  // em andamento a cada revalidação silenciosa do react-query.
  useEffect(() => {
    if (data) setDraftTiers(data.data.map(tierToDraft))
  }, [data])

  const parsedTiers = draftTiers.map(draftToTier)
  const hasParseError = parsedTiers.some((tier) => tier === undefined)

  function updateRow(index: number, patch: Partial<DeliveryFeeTierDraft>) {
    setDraftTiers((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setDraftTiers((current) =>
      current.length >= DELIVERY_FEE_TIERS_MAX_COUNT
        ? current
        : [...current, { maxDistanceKmText: '', feeInReaisText: '' }],
    )
  }

  function removeRow(index: number) {
    setDraftTiers((current) => current.filter((_, rowIndex) => rowIndex !== index))
  }

  function save() {
    setGeneralError(undefined)
    setRowErrors(new Map())

    if (hasParseError) {
      setGeneralError('Preencha distância e taxa em todas as linhas antes de salvar.')
      return
    }

    const tiers = parsedTiers as DeliveryFeeTier[]
    replaceMutation.mutate(tiers, {
      onError: (error: unknown) => {
        const code = getApiErrorCode(error)
        const message = error instanceof Error ? error.message : 'Erro inesperado'
        if (code === 'VALIDATION_ERROR') {
          setRowErrors(parseDeliveryFeeTiersErrorMessage(message))
        }
        setGeneralError(message)
      },
    })
  }

  const outOfRangeWarning = resolveOutOfRangeWarning(parsedTiers.filter((tier): tier is DeliveryFeeTier => !!tier))

  return {
    isReady,
    isLoading,
    draftTiers,
    rowErrors,
    generalError,
    outOfRangeWarning,
    canAddRow: draftTiers.length < DELIVERY_FEE_TIERS_MAX_COUNT,
    isSaving: replaceMutation.isPending,
    updateRow,
    addRow,
    removeRow,
    save,
  }
}
