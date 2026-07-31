/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Converte o `File` que o navegador entrega no formato que `ConversationsApi.sendMedia` pede.
 *
 * A rota recebe base64 e não multipart porque é o mesmo formato que a Graph API consome — traduzir
 * duas vezes (multipart aqui, base64 lá) só acrescentaria uma cópia do binário no caminho.
 */

export type MediaAttachment = {
  readonly base64: string
  readonly mimeType: string
  readonly filename: string
}

/** Nome de arquivo para o que o gravador produz sem nome próprio. */
const RECORDED_AUDIO_FALLBACK_NAME = 'audio.ogg'

export async function fileToAttachment(file: File): Promise<MediaAttachment> {
  const buffer = await file.arrayBuffer()

  /**
   * Converte em blocos, não com `String.fromCharCode(...bytes)` de uma vez.
   *
   * Espalhar um array de centenas de milhares de bytes como argumentos estoura o limite de argumentos
   * da engine — um áudio de poucos segundos já chega perto. O sintoma seria um `RangeError` só nos
   * arquivos grandes, que é o tipo de erro que passa em teste e falha em produção.
   */
  const bytes = new Uint8Array(buffer)
  const CHUNK_SIZE = 8192
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE))
  }

  return {
    base64: btoa(binary),
    // Gravação de voz pode vir sem mime em navegador antigo; `audio/ogg` é o que a Meta aceita.
    mimeType: file.type || 'audio/ogg',
    filename: file.name || RECORDED_AUDIO_FALLBACK_NAME,
  }
}
