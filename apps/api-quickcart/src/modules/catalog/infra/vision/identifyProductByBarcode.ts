/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Liga o leitor de código de barras ao catálogo: foto da embalagem vira produto do estoque.
 *
 * É o degrau exato do cascata de visão que não precisa de índice nenhum — `products.barcode` é
 * único e `findByBarcode` já existe. A busca por similaridade visual chega quando o catálogo
 * migrar para o `@adatechnology/catalog-module`, que já tem o pgvector pronto.
 */

import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ProductIdentification } from '@/modules/conversation/application/resolveInboundImage'

/**
 * A forma mínima do engine, declarada aqui em vez de importada.
 *
 * A porta do `product-vision-provider` é estrutural de propósito: qualquer objeto com `read` serve.
 * Declarar o mínimo mantém este arquivo testável sem WASM e sem o pacote instalado — e o dia em que
 * o engine ganhar campos, nada aqui muda.
 */
export type BarcodeVisionEngine = {
  read(input: { readonly buffer: Buffer; readonly mimeType: string }): Promise<{ readonly barcode?: string }>
}

export type IdentifyProductByBarcodeDependencies = {
  readonly engine: BarcodeVisionEngine
  readonly productRepository: Pick<ProductRepositoryInterface, 'findByBarcode'>
}

export function createBarcodeProductIdentifier(dependencies: IdentifyProductByBarcodeDependencies) {
  return async function identifyProduct(image: {
    readonly bytes: Uint8Array
    readonly mimeType: string
  }): Promise<ProductIdentification> {
    const reading = await dependencies.engine.read({
      buffer: Buffer.from(image.bytes),
      mimeType: image.mimeType,
    })

    // Sem código legível na foto não há o que consultar. `unmatched` e não erro: fotografar a
    // embalagem de lado é o caso comum, não uma falha do sistema.
    if (!reading.barcode) return { outcome: 'unmatched' }

    const product = await dependencies.productRepository.findByBarcode(reading.barcode)
    if (!product) return { outcome: 'unmatched' }

    // O nome volta como o cliente teria digitado, e é o `searchByTerm` do fluxo normal que casa o
    // item depois. Devolver o id daria um atalho que nenhum handler sabe receber hoje.
    return { outcome: 'identified', productName: buildProductTerm(product) }
  }
}

/**
 * Marca e tamanho entram no termo porque o catálogo tem irmãos que só diferem neles — "Leite
 * Itambé 1L" e "Leite Itambé 2L" têm códigos de barras distintos e nomes iguais. Sem o tamanho, a
 * busca que recebe este texto voltaria aos dois e perguntaria o que a foto já respondeu.
 */
function buildProductTerm(product: {
  readonly name: string
  readonly brand?: string | null
  readonly unitSize?: string | null
}): string {
  return [product.brand, product.name, product.unitSize].filter(Boolean).join(' ').trim()
}
