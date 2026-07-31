/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Guarda o áudio gravado no simulador e devolve o `uploadId` que o webhook vai referenciar.
 *
 * Só encanamento: quem grava, com que chave e como o id é marcado vive no
 * `StorePreviewMediaUseCase` do módulo. Rota fica aqui porque endpoint é do host — o SDK, por
 * princípio, não abre caminho no servidor de quem o instala.
 *
 * Mesmas duas travas da rota de transcript do preview: flag desligada por padrão e assinatura HMAC
 * do app secret. Para quem não tem as duas, a rota é indistinguível de inexistente.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { StorePreviewMediaUseCase } from '@adatechnology/meta-whatsapp-module'
import type { RouteHandler } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'

const PREVIEW_SIGNATURE_HEADER = 'x-preview-signature'
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } }

/**
 * Teto do que a rota aceita, em caracteres de base64.
 *
 * Base64 infla o binário em ~33%, então isto equivale a uns 7MB de áudio — muito acima de qualquer
 * nota de voz e bem abaixo do que derrubaria o processo. Sem teto, um POST de um giga chegaria à
 * memória antes de alguém decidir se queria.
 */
const MAX_BASE64_LENGTH = 10_000_000

function expectedSignature(payload: string, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`
}

function signatureMatches(received: string | undefined, expected: string): boolean {
  if (!received) return false
  const receivedBytes = Buffer.from(received)
  const expectedBytes = Buffer.from(expected)
  // Comprimentos diferentes fariam `timingSafeEqual` lançar — e o lançamento vazaria a diferença.
  if (receivedBytes.length !== expectedBytes.length) return false
  return timingSafeEqual(receivedBytes, expectedBytes)
}

type PreviewMediaBody = {
  readonly base64?: unknown
  readonly mimeType?: unknown
  readonly filename?: unknown
}

export function createPreviewMediaController(storePreviewMedia: StorePreviewMediaUseCase | undefined) {
  const handleUpload: RouteHandler = async (request, response) => {
    const appSecret = environment.WHATSAPP_APP_SECRET

    // Sem o recurso ligado no módulo, a rota não existe — nem para quem tem a assinatura.
    if (!storePreviewMedia || !environment.PREVIEW_TRANSCRIPT_ENABLED || !appSecret) {
      response.json(404, NOT_FOUND)
      return
    }

    const body = (request.body ?? {}) as PreviewMediaBody
    const base64 = typeof body.base64 === 'string' ? body.base64 : ''
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''

    /**
     * A assinatura cobre o MIME, não o binário.
     *
     * Assinar megabytes de base64 no navegador travaria a aba a cada nota de voz. O que a assinatura
     * protege aqui é o acesso à rota, e o binário já está limitado por tamanho e só é alcançável por
     * um id que o próprio servidor gera.
     */
    if (!signatureMatches(request.headers[PREVIEW_SIGNATURE_HEADER], expectedSignature(mimeType, appSecret))) {
      response.json(404, NOT_FOUND)
      return
    }

    if (base64.length === 0 || base64.length > MAX_BASE64_LENGTH) {
      response.json(400, { error: { code: 'VALIDATION_ERROR', message: 'Áudio ausente ou grande demais' } })
      return
    }

    const result = await storePreviewMedia.execute({
      companyId: environment.WHATSAPP_COMPANY_ID,
      buffer: Buffer.from(base64, 'base64'),
      mimeType: mimeType || 'audio/ogg',
      ...(typeof body.filename === 'string' ? { filename: body.filename } : {}),
    })

    // Devolve o `uploadId` cru: quem monta o id prefixado é o helper do SDK, dono da convenção.
    response.json(201, { data: { uploadId: result.uploadId } })
  }

  return { handleUpload }
}
