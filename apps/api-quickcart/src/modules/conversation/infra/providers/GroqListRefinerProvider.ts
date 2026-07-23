/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Refinador opcional via Groq (Llama 3.3). O bot nunca depende dele: qualquer erro
 * (timeout, resposta inválida, ausência de GROQ_API_KEY) faz o caller usar o resultado
 * do regex — ver ParseShoppingList.use-case.ts.
 */

import { environment } from '@/infra/config/environment'
import type { ListRefinerProvider } from '@/modules/conversation/application/providers/ListRefinerProvider.interface'
import { GROQ_CHAT_COMPLETIONS_URL, GROQ_CHAT_MODEL, GROQ_REFINE_TIMEOUT_MS } from '@/modules/conversation/shared/Groq.constant'
import type { ParsedListItem } from '@/modules/conversation/application/types/ParseShoppingList.types'
import { LOG_EVENTS } from '@/shared/constants/log-events.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const refinerLog = logger.child('GroqListRefinerProvider')

const SYSTEM_PROMPT =
  'Você extrai itens de uma lista de compras de supermercado em português. ' +
  'Responda APENAS com um JSON array de objetos {"term": string, "quantity": number, "unit": string}, ' +
  'sem texto adicional. "term" é o nome do produto sem quantidade/unidade. ' +
  '"unit" é uma abreviação curta (kg, g, l, ml, un, dz). Se não houver quantidade explícita, use quantity=1 e unit="un".'

function isRefinedItem(value: unknown): value is ParsedListItem {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.term === 'string' &&
    candidate.term.trim().length > 0 &&
    typeof candidate.quantity === 'number' &&
    candidate.quantity > 0 &&
    typeof candidate.unit === 'string' &&
    candidate.unit.trim().length > 0
  )
}

function parseRefinedItems(content: string): readonly ParsedListItem[] | undefined {
  const parsed: unknown = JSON.parse(content)
  if (!Array.isArray(parsed) || parsed.length === 0) return undefined
  if (!parsed.every(isRefinedItem)) return undefined
  return parsed
}

export class GroqListRefinerProvider implements ListRefinerProvider {
  async refine(rawText: string): Promise<readonly ParsedListItem[] | undefined> {
    if (!environment.GROQ_API_KEY) return undefined

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), GROQ_REFINE_TIMEOUT_MS)

    try {
      const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${environment.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_CHAT_MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: rawText },
          ],
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        refinerLog.warn(LOG_EVENTS.CONVERSATION_LIST_REFINE_NON_OK, { status: response.status })
        return undefined
      }

      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] }
      const content = payload.choices?.[0]?.message?.content
      if (!content) return undefined

      return parseRefinedItems(content)
    } catch (error) {
      refinerLog.warn(LOG_EVENTS.CONVERSATION_LIST_REFINE_FAILED, {
        error: serializeError(error),
      })
      return undefined
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
