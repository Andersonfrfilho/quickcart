/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Product } from '@/infra/database/schema'

export type CreateProductRecordParams = {
  readonly id: string
  readonly categoryId: string
  readonly name: string
  readonly brand?: string | undefined
  readonly description?: string | undefined
  readonly unit: string
  readonly unitSize?: string | undefined
  readonly priceInCents: number
  readonly stockQuantity: number
  readonly isAvailable: boolean
  readonly imageUrl?: string | undefined
  readonly aliases: readonly string[]
  readonly barcode?: string | undefined
}

export type UpdateProductRecordParams = {
  readonly categoryId?: string | undefined
  readonly name?: string | undefined
  readonly brand?: string | null | undefined
  readonly description?: string | null | undefined
  readonly unit?: string | undefined
  readonly unitSize?: string | null | undefined
  readonly priceInCents?: number | undefined
  readonly isAvailable?: boolean | undefined
  readonly imageUrl?: string | null | undefined
  readonly aliases?: readonly string[] | undefined
  readonly barcode?: string | null | undefined
}

export type ListProductsRepositoryParams = {
  readonly categoryId?: string | undefined
  readonly onlyAvailable: boolean
  readonly page: number
  readonly perPage: number
  readonly sortBy: 'name' | 'priceInCents' | 'stockQuantity' | 'createdAt'
  readonly sortDirection: 'asc' | 'desc'
}

export type ListProductsRepositoryResult = {
  readonly items: Product[]
  readonly total: number
}

export type ProductSearchResult = {
  readonly id: string
  readonly name: string
  readonly brand: string | null
  readonly unitSize: string | null
  readonly priceInCents: number
  readonly score: number
}

export interface ProductRepositoryInterface {
  create(params: CreateProductRecordParams): Promise<Product>
  update(id: string, params: UpdateProductRecordParams): Promise<Product>
  findById(id: string): Promise<Product | undefined>
  findByBarcode(barcode: string): Promise<Product | undefined>
  adjustStock(id: string, delta: number): Promise<Product | undefined>
  list(params: ListProductsRepositoryParams): Promise<ListProductsRepositoryResult>
  searchByTerm(term: string, limit: number): Promise<ProductSearchResult[]>
}
