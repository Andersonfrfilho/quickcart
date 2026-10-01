/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O painel substitui a lista inteira (spec §3.6). Este use case é o único ponto que faz isso: lê a
 * lista antiga antes de trocar, para a trilha de auditoria (`security.md` §10) registrar o antes e o
 * depois — sem isto, a auditoria diria só "alguém mudou", nunca o quê.
 */

import { logger } from '@/shared/logger'
import type { DeliveryFeeTier, DeliveryFeeTierRepositoryInterface } from '@/modules/order/domain/DeliveryFeeTierRepository.interface'

const useCaseLog = logger.child('ReplaceDeliveryFeeTiers')

type ReplaceDeliveryFeeTiersUseCaseDependencies = {
  readonly deliveryFeeTierRepository: DeliveryFeeTierRepositoryInterface
}

export type ReplaceDeliveryFeeTiersParams = {
  readonly tiers: readonly DeliveryFeeTier[]
  /** Id de quem agiu — nunca o e-mail (`security.md` §1: PII fora do log). */
  readonly actorUserId: string
}

export class ReplaceDeliveryFeeTiersUseCase {
  constructor(private readonly dependencies: ReplaceDeliveryFeeTiersUseCaseDependencies) {}

  async execute(params: ReplaceDeliveryFeeTiersParams): Promise<readonly DeliveryFeeTier[]> {
    const previousTiers = await this.dependencies.deliveryFeeTierRepository.listOrdered()
    await this.dependencies.deliveryFeeTierRepository.replaceAll(params.tiers)

    useCaseLog.info('delivery_fee_tiers_replaced', {
      actorUserId: params.actorUserId,
      previousTiers,
      newTiers: params.tiers,
    })

    return params.tiers
  }
}
