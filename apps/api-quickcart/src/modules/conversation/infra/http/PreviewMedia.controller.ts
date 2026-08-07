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
 * Mesma trava da rota de transcript do preview: a flag `PREVIEW_TRANSCRIPT_ENABLED`, desligada por
 * padrão. Para quem não a tem ligada, a rota é indistinguível de inexistente. O HMAC que existia
 * aqui saiu junto com o app secret do bundle — ver `PreviewTranscript.controller`.
 */

import type { StorePreviewMediaUseCase } from '@adatechnology/meta-whatsapp-module'
import type { RouteHandler } from '@/infra/http/router'
import { environment } from '@/infra/config/environment'

const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } }

/**
 * Teto do que a rota aceita, em caracteres de base64.
 *
 * Base64 infla o binário em ~33%, então isto equivale a uns 7MB de áudio — muito acima de qualquer
 * nota de voz e bem abaixo do que derrubaria o processo. Sem teto, um POST de um giga chegaria à
 * memória antes de alguém decidir se queria.
 */
const MAX_BASE64_LENGTH = 10_000_000

type PreviewMediaBody = {
  readonly base64?: unknown
  readonly mimeType?: unknown
  readonly filename?: unknown
}

export function createPreviewMediaController(storePreviewMedia: StorePreviewMediaUseCase | undefined) {
  const handleUpload: RouteHandler = async (request, response) => {
    // Sem o recurso ligado no módulo, a rota não existe — nem com a flag ligada.
    if (!storePreviewMedia || !environment.PREVIEW_TRANSCRIPT_ENABLED) {
      response.json(404, NOT_FOUND)
      return
    }

    const body = (request.body ?? {}) as PreviewMediaBody
    const base64 = typeof body.base64 === 'string' ? body.base64 : ''
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''

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
