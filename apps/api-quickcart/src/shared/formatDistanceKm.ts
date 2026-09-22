/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Distância para o cliente ler: 0,1 km de resolução e vírgula decimal (pt-BR). Mesma regra no bot,
 * na tela e na mensagem de erro — senão cada canal diria um número diferente para o mesmo endereço.
 */

export function roundDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm * 10) / 10
}

export function formatDistanceKm(distanceKm: number): string {
  return String(roundDistanceKm(distanceKm)).replace('.', ',')
}
