/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Transforma o JPEG que chega do WhatsApp nos pixels que o leitor de código de barras espera.
 *
 * O provider tenta `createImageBitmap` + `OffscreenCanvas` quando existem, e o Bun no servidor não
 * tem nenhum dos dois — sem este adaptador, a primeira foto real derruba a leitura com
 * "Este runtime nao decodifica imagem sozinho".
 */

import sharp from 'sharp'

export type DecodedImage = {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
  readonly colorSpace: 'srgb'
}

export async function decodeImageWithSharp(
  input: { readonly buffer: Buffer; readonly mimeType: string },
  maxPixels: number,
): Promise<DecodedImage> {
  const image = sharp(input.buffer, { failOn: 'none' })
  const { width = 0, height = 0 } = await image.metadata()
  if (width === 0 || height === 0) throw new Error('Imagem sem dimensão legível.')

  // Reduz antes de decodificar por inteiro: foto de celular passa de 12MP e o zbar percorre a
  // imagem toda. O fator sai da área, não do lado, senão uma foto panorâmica escaparia do teto.
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const { data, info } = await image
    .rotate() // Respeita o EXIF: foto de celular deitada chega girada, e código de barras girado não lê.
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
    colorSpace: 'srgb',
  }
}
