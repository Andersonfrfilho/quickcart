/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A cadeia inteira com o leitor DE VERDADE: foto de embalagem entra, texto do produto sai.
 *
 * Os testes com dublê cobrem cada peça e não cobrem o encaixe — foi assim que os nomes de formato
 * do zbar passaram errados por uma release inteira, com todo mundo verde. Aqui o código de barras
 * é gerado, decodificado pelo zbar real e casado contra o catálogo.
 */

import { describe, expect, it } from 'bun:test'
import sharp from 'sharp'
import { createBarcodeReader } from '@adatechnology/product-vision-provider/barcode'
import { createBarcodeProductIdentifier } from '@/modules/catalog/infra/vision/identifyProductByBarcode'
import { decodeImageWithSharp } from '@/modules/catalog/infra/vision/decodeImageWithSharp'
import { createInboundImageResolver } from '@/modules/conversation/application/resolveInboundImage'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'
import type { ParsedInboundMessage } from '@/modules/webhook/application/types/WhatsAppWebhookPayload.types'

const LEFT = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const GREEN = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
const RIGHT = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

function withChecksum(twelve: string): string {
  const total = [...twelve].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)
  return twelve + String((10 - (total % 10)) % 10)
}

function renderEan13(code: string): ImageData {
  const parity = PARITY[Number(code[0])]!
  let bits = '101'
  for (let i = 0; i < 6; i++) bits += (parity[i] === 'L' ? LEFT : GREEN)[Number(code[1 + i])]!
  bits += '01010'
  for (let i = 0; i < 6; i++) bits += RIGHT[Number(code[7 + i])]!
  bits += '101'

  const moduleWidth = 3
  const quiet = 30
  const height = 120
  const width = quiet * 2 + bits.length * moduleWidth
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let y = 0; y < height; y++) {
    for (let index = 0; index < bits.length; index++) {
      if (bits[index] !== '1') continue
      for (let dx = 0; dx < moduleWidth; dx++) {
        const offset = (y * width + quiet + index * moduleWidth + dx) * 4
        data[offset] = data[offset + 1] = data[offset + 2] = 0
      }
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as unknown as ImageData
}

const CODE = withChecksum('789100010010')
const PHONE = '5511977770001'
const imageMessage: ParsedInboundMessage = {
  kind: 'image',
  from: PHONE,
  waMessageId: 'wamid.image.1',
  mediaId: 'media-1',
  mimeType: 'image/jpeg',
}

function buildResolver(catalogo: { barcode: string; produto?: unknown }) {
  const notices: string[] = []
  const identifyProduct = createBarcodeProductIdentifier({
    // Engine real. `decodeImage` entra porque este runtime não tem OffscreenCanvas — é a mesma
    // porta que produção usa para plugar sharp/jimp.
    engine: createBarcodeReader({}, { decodeImage: async () => renderEan13(CODE) }),
    productRepository: {
      findByBarcode: async (barcode: string) => (barcode === catalogo.barcode ? catalogo.produto : undefined) as never,
    },
  })

  const resolve = createInboundImageResolver({
    identifyProduct,
    fetchMediaAsBase64: async () => ({ data: Buffer.from('foto').toString('base64'), mimeType: 'image/jpeg' }),
    sendNotice: async (_to: string, body: string) => {
      notices.push(body)
    },
  })

  return { resolve, notices }
}

describe('foto de embalagem, do zbar até o catálogo', () => {
  it('vira o texto que o cliente teria digitado', async () => {
    const { resolve } = buildResolver({
      barcode: CODE,
      produto: { id: 'p1', name: 'Leite Integral', brand: 'Itambé', unitSize: '1L' },
    })

    const resolved = await resolve({ message: imageMessage, whatsappNumber: PHONE })

    expect(resolved).toEqual({
      kind: 'text',
      from: PHONE,
      waMessageId: 'wamid.image.1',
      body: 'Itambé Leite Integral 1L',
    })
  })

  it('código lido que a loja não cadastrou explica e devolve o original', async () => {
    const { resolve, notices } = buildResolver({ barcode: 'outro-codigo' })

    expect(await resolve({ message: imageMessage, whatsappNumber: PHONE })).toBe(imageMessage)
    expect(notices).toEqual([MESSAGES.IMAGE_PRODUCT_NOT_FOUND])
  })
})

describe('o caminho que a foto do WhatsApp percorre de verdade', () => {
  it('JPEG comprimido vira produto do catálogo, sem decoder injetado', async () => {
    // O `decodeImage` default do provider usa `OffscreenCanvas`, que o Bun no servidor não tem —
    // é por isso que o produto pluga o sharp. Este teste é o único que exercita esse trecho, e
    // sem ele a primeira foto real em produção derrubaria a leitura.
    const pixels = renderEan13(CODE) as unknown as { data: Uint8ClampedArray; width: number; height: number }
    const jpeg = await sharp(Buffer.from(pixels.data.buffer), {
      raw: { width: pixels.width, height: pixels.height, channels: 4 },
    })
      .jpeg({ quality: 80 })
      .toBuffer()

    const identify = createBarcodeProductIdentifier({
      engine: createBarcodeReader({}, { decodeImage: (input, maxPixels) => decodeImageWithSharp(input, maxPixels) }),
      productRepository: {
        findByBarcode: async (barcode: string) =>
          (barcode === CODE ? { id: 'p1', name: 'Leite Integral', brand: 'Itambé', unitSize: '1L' } : undefined) as never,
      },
    })

    const resultado = await identify({ bytes: new Uint8Array(jpeg), mimeType: 'image/jpeg' })

    expect(resultado).toEqual({ outcome: 'identified', productName: 'Itambé Leite Integral 1L' })
  })
})
