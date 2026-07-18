/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Erros do domínio de catálogo (categorias e produtos).
 */

import { DomainError } from '@/shared/errors/DomainError'
import {
  CATEGORY_NOT_FOUND,
  CATEGORY_NAME_DUPLICATE,
  PRODUCT_NOT_FOUND,
  PRODUCT_BARCODE_DUPLICATE,
  PRODUCT_INSUFFICIENT_STOCK,
  PRODUCT_SEARCH_QUERY_TOO_SHORT,
} from '@/shared/errors/codes'

const CATALOG_DOMAIN = 'catalog'

export class CatalogError extends DomainError {
  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message, statusCode, code, CATALOG_DOMAIN, details)
    this.name = 'CatalogError'
  }
}

export class CategoryNotFoundError extends CatalogError {
  constructor(categoryId: string) {
    super(`Categoria "${categoryId}" não encontrada.`, 404, CATEGORY_NOT_FOUND, { categoryId })
  }
}

export class CategoryNameDuplicateError extends CatalogError {
  constructor(name: string) {
    super(`Categoria "${name}" já existe.`, 409, CATEGORY_NAME_DUPLICATE, { name })
  }
}

export class ProductNotFoundError extends CatalogError {
  constructor(productId: string) {
    super(`Produto "${productId}" não encontrado.`, 404, PRODUCT_NOT_FOUND, { productId })
  }
}

export class ProductBarcodeDuplicateError extends CatalogError {
  constructor(barcode: string) {
    super(`Já existe um produto com o código de barras "${barcode}".`, 409, PRODUCT_BARCODE_DUPLICATE, { barcode })
  }
}

export class ProductInsufficientStockError extends CatalogError {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Estoque insuficiente para o produto "${productId}".`,
      409,
      PRODUCT_INSUFFICIENT_STOCK,
      { productId, requested, available },
    )
  }
}

export class ProductSearchQueryTooShortError extends CatalogError {
  constructor(minimumLength: number) {
    super(`A busca exige ao menos ${minimumLength} caracteres.`, 400, PRODUCT_SEARCH_QUERY_TOO_SHORT, { minimumLength })
  }
}
