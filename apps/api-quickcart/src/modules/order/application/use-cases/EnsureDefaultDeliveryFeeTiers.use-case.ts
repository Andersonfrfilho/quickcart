/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Seed de boot idempotente (spec §3.1, design.md "Modelo de dados"): SQL não lê env, então a
 * primeira subida da feature precisa de alguém gravando as faixas de D4 na tabela vazia — e só
 * na tabela vazia. Uma faixa que o painel já editou nunca é tocada, mesmo que difira das
 * constantes: sobrescrever aqui destruiria a configuração do lojista a cada deploy.
 */

import { DEFAULT_DELIVERY_FEE_TIERS } from '@/modules/order/shared/DefaultDeliveryFeeTiers.constant'
import type { DeliveryFeeTierRepositoryInterface } from '@/modules/order/domain/DeliveryFeeTierRepository.interface'

type EnsureDefaultDeliveryFeeTiersDependencies = {
  readonly deliveryFeeTierRepository: DeliveryFeeTierRepositoryInterface
}

export class EnsureDefaultDeliveryFeeTiersUseCase {
  constructor(private readonly dependencies: EnsureDefaultDeliveryFeeTiersDependencies) {}

  async execute(): Promise<void> {
    const existing = await this.dependencies.deliveryFeeTierRepository.listOrdered()
    if (existing.length > 0) return

    await this.dependencies.deliveryFeeTierRepository.replaceAll(DEFAULT_DELIVERY_FEE_TIERS)
  }
}
