/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Faixas de staging (spec §2, D4) — só usadas quando a tabela nasce vazia (T1.3).
 */

import type { DeliveryFeeTier } from '@/modules/order/domain/DeliveryFeeTierRepository.interface'

export const DEFAULT_DELIVERY_FEE_TIERS: readonly DeliveryFeeTier[] = [
  { maxDistanceKm: 3, feeInCents: 500 },
  { maxDistanceKm: 8, feeInCents: 1000 },
] as const
