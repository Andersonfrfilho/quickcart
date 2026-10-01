/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Coordenada é dado pessoal (spec §3.2, LGPD): o pedido guarda a localização do WhatsApp para o
 * entregador, mas nenhuma resposta HTTP precisa dela — a tela mostra endereço e distância, nunca o ponto.
 * Toda serialização de pedido para fora da api passa por aqui.
 */

const COORDINATE_KEYS: ReadonlySet<string> = new Set(['latitude', 'longitude'])

export function omitCoordinates(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !COORDINATE_KEYS.has(key)))
}

export function withoutAddressCoordinates<TOrder extends { readonly address?: unknown }>(order: TOrder): TOrder {
  if (!('address' in order)) return order
  return { ...order, address: omitCoordinates(order.address) }
}
