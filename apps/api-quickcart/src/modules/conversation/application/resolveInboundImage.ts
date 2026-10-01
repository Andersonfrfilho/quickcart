/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Troca foto de produto por texto na entrada, antes de qualquer roteamento — a mesma estratégia do
 * `resolveInboundAudio`, e pelo mesmo motivo.
 *
 * O cliente que fotografa a embalagem está dizendo "quero este"; hoje ele recebe o mesmo
 * `unsupported` de um sticker. Resolvendo aqui, quem atende recebe `kind: 'text'` com o nome do
 * produto e não precisa saber que houve foto: o `ListHandler` monta o item, o `BrowseHandler`
 * busca, e nenhum caminho novo precisa lembrar de tratar imagem.
 *
 * Falha, foto ilegível e produto não encontrado devolvem a mensagem ORIGINAL, de propósito: o
 * comportamento de quem recebe imagem hoje continua valendo, e a capacidade indisponível degrada
 * em vez de quebrar.
 */

import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const imageLog = logger.child('InboundImage')

/**
 * Resultado da identificação. União fechada porque cada desfecho vira uma conversa diferente, e um
 * `productName?: string` obrigaria quem chama a redescobrir a distinção entre "achei" e "achei
 * vários".
 */
export type ProductIdentification =
  | { readonly outcome: 'identified'; readonly productName: string }
  | { readonly outcome: 'candidates'; readonly candidates: readonly { id: string; name: string }[] }
  | { readonly outcome: 'unmatched' }

export type InboundImageResolverDependencies = {
  /**
   * Ausente = a capacidade não existe, e foto segue crua para quem sabe lidar com ela.
   *
   * A porta esconde COMO se identifica: leitura de código de barras sozinha, busca vetorial, ou as
   * duas em cascata. O produto escolhe no wiring, sem que este arquivo mude.
   */
  readonly identifyProduct?:
    | ((image: { readonly bytes: Uint8Array; readonly mimeType: string }) => Promise<ProductIdentification>)
    | undefined
  readonly fetchMediaAsBase64: (mediaId: string) => Promise<{ readonly data: string; readonly mimeType: string }>
  readonly sendNotice: (whatsappNumber: string, body: string) => Promise<void>
}

export type ResolveInboundImageParams = {
  readonly message: ParsedInboundMessage
  readonly whatsappNumber: string
}

export type ResolveInboundImage = (params: ResolveInboundImageParams) => Promise<ParsedInboundMessage>

export function createInboundImageResolver(dependencies: InboundImageResolverDependencies): ResolveInboundImage {
  return async function resolveInboundImage(params: ResolveInboundImageParams): Promise<ParsedInboundMessage> {
    const { message } = params
    if (message.kind !== 'image' || !dependencies.identifyProduct) return message

    try {
      const media = await dependencies.fetchMediaAsBase64(message.mediaId)
      const identification = await dependencies.identifyProduct({
        bytes: Buffer.from(media.data, 'base64'),
        mimeType: media.mimeType,
      })

      if (identification.outcome === 'identified') {
        // Vira o texto que o cliente teria digitado. É o que faz todo o fluxo existente funcionar
        // sem uma linha nova em nenhum handler.
        return { kind: 'text', from: message.from, waMessageId: message.waMessageId, body: identification.productName }
      }

      if (identification.outcome === 'candidates') {
        await dependencies.sendNotice(params.whatsappNumber, buildCandidatesQuestion(identification.candidates))
        // A mensagem original segue para quem trata `image`: a pergunta já foi feita, e a resposta
        // do cliente entra pelo caminho normal de texto.
        return message
      }

      await dependencies.sendNotice(params.whatsappNumber, MESSAGES.IMAGE_PRODUCT_NOT_FOUND)
      return message
    } catch (error) {
      // A foto do cliente é conteúdo de mensagem e não entra em log em nenhum nível: só o id
      // opaco da mídia e o erro.
      imageLog.warn('Falha ao identificar produto pela imagem', {
        waMessageId: message.waMessageId,
        error: serializeError(error),
      })
      return message
    }
  }
}

function buildCandidatesQuestion(candidates: readonly { id: string; name: string }[]): string {
  const options = candidates.map((candidate, index) => `${index + 1}. ${candidate.name}`).join('\n')

  return `${MESSAGES.IMAGE_PRODUCT_CANDIDATES}\n\n${options}`
}
