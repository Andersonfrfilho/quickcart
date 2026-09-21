/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { db } from '@/infra/database/connection'
import { products, type Product } from '@/infra/database/schema'
import type {
  CreateProductRecordParams,
  ListProductsRepositoryParams,
  ListProductsRepositoryResult,
  ProductRepositoryInterface,
  ProductSearchResult,
  SubstituteCandidateParams,
  UpdateProductRecordParams,
} from '@/modules/catalog/domain/ProductRepository.interface'

const SORTABLE_COLUMNS = {
  name: products.name,
  priceInCents: products.priceInCents,
  stockQuantity: products.stockQuantity,
  createdAt: products.createdAt,
} as const

function stripUndefinedFields<TInput extends Record<string, unknown>>(
  input: TInput,
): { [TKey in keyof TInput]?: Exclude<TInput[TKey], undefined> } {
  const result = {} as { [TKey in keyof TInput]?: Exclude<TInput[TKey], undefined> }

  for (const key of Object.keys(input) as (keyof TInput)[]) {
    const value = input[key]
    if (value !== undefined) result[key] = value as Exclude<TInput[typeof key], undefined>
  }

  return result
}

type SearchRow = {
  readonly id: string
  readonly name: string
  readonly brand: string | null
  readonly unit_size: string | null
  readonly price_in_cents: number
  readonly score: number
}

export class DrizzleProductRepository implements ProductRepositoryInterface {
  async create(params: CreateProductRecordParams): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values({
        id: params.id,
        categoryId: params.categoryId,
        name: params.name,
        brand: params.brand ?? null,
        description: params.description ?? null,
        unit: params.unit,
        unitSize: params.unitSize ?? null,
        priceInCents: params.priceInCents,
        stockQuantity: params.stockQuantity,
        isAvailable: params.isAvailable,
        imageUrl: params.imageUrl ?? null,
        aisle: params.aisle ?? null,
        aliases: [...params.aliases],
        barcode: params.barcode ?? null,
      })
      .returning()

    return product as Product
  }

  async update(id: string, params: UpdateProductRecordParams): Promise<Product> {
    const { aliases, ...rest } = params
    const [product] = await db
      .update(products)
      .set({
        ...stripUndefinedFields(rest),
        ...(aliases ? { aliases: [...aliases] } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning()

    return product as Product
  }

  async findById(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    return product
  }

  async findByBarcode(barcode: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1)
    return product
  }

  async adjustStock(id: string, delta: number): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set({ stockQuantity: sql`${products.stockQuantity} + ${delta}`, updatedAt: new Date() })
      .where(and(eq(products.id, id), sql`${products.stockQuantity} + ${delta} >= 0`))
      .returning()

    return product
  }

  async list(params: ListProductsRepositoryParams): Promise<ListProductsRepositoryResult> {
    const conditions: SQL[] = []
    if (params.categoryId && params.categoryId.length > 0) conditions.push(inArray(products.categoryId, [...params.categoryId]))
    if (params.onlyAvailable) conditions.push(eq(products.isAvailable, true))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = SORTABLE_COLUMNS[params.sortBy]
    const orderBy = params.sortDirection === 'desc' ? desc(sortColumn) : asc(sortColumn)
    const offset = (params.page - 1) * params.perPage

    const [items, countRows] = await Promise.all([
      db.select().from(products).where(where).orderBy(orderBy).limit(params.perPage).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
    ])

    return { items, total: countRows[0]?.total ?? 0 }
  }

  async searchByTerm(term: string, limit: number): Promise<ProductSearchResult[]> {
    const result = await db.execute<SearchRow>(sql`
      SELECT id, name, brand, unit_size, price_in_cents,
             GREATEST(
               similarity(lower(immutable_unaccent(name)), lower(immutable_unaccent(${term}))),
               similarity(lower(immutable_unaccent(coalesce(brand, '') || ' ' || name)), lower(immutable_unaccent(${term}))),
               (SELECT COALESCE(MAX(similarity(lower(immutable_unaccent(a)), lower(immutable_unaccent(${term})))), 0)
                  FROM unnest(aliases) a)
             ) AS score
      FROM products
      WHERE is_available = true AND stock_quantity > 0
      ORDER BY score DESC
      LIMIT ${limit}
    `)

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      unitSize: row.unit_size,
      priceInCents: row.price_in_cents,
      score: Number(row.score),
    }))
  }

  /**
   * O parecido, achado a partir do produto que faltou — e não de um termo digitado.
   *
   * A trava é o `WHERE`, não o score: mesma categoria, mesma unidade e mesmo tamanho de embalagem. O
   * `similarity()` entra depois, só para escolher entre os que já passaram — sozinho, ele traria "Leite
   * Integral 2L" para "Leite Integral 1L" com nota altíssima, que é a troca errada com a maior confiança.
   *
   * Um candidato, o de maior nota. Escolher entre três marcas é trabalho que a loja estaria empurrando
   * para quem só queria comprar leite (ADR 0003).
   */
  async findSubstituteCandidate(params: SubstituteCandidateParams): Promise<ProductSearchResult | undefined> {
    const result = await db.execute<SearchRow>(sql`
      SELECT candidate.id, candidate.name, candidate.brand, candidate.unit_size, candidate.price_in_cents,
             GREATEST(
               similarity(lower(immutable_unaccent(candidate.name)), lower(immutable_unaccent(origin.name))),
               similarity(
                 lower(immutable_unaccent(coalesce(candidate.brand, '') || ' ' || candidate.name)),
                 lower(immutable_unaccent(origin.name))
               )
             ) AS score
      FROM products candidate
      JOIN products origin ON origin.id = ${params.productId}
      WHERE candidate.id <> origin.id
        AND candidate.category_id = origin.category_id
        AND candidate.unit = origin.unit
        AND candidate.unit_size IS NOT DISTINCT FROM origin.unit_size
        AND candidate.is_available = true
        AND candidate.stock_quantity >= ${params.requiredQuantity}
      ORDER BY score DESC
      LIMIT 1
    `)

    const row = result.rows[0]
    if (!row) return undefined

    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      unitSize: row.unit_size,
      priceInCents: row.price_in_cents,
      score: Number(row.score),
    }
  }
}
