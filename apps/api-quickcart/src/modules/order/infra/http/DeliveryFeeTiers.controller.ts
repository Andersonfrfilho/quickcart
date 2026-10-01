/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Painel de faixas de entrega (spec §3.6). `userModule` injetável pelo mesmo motivo do
 * `ConversationCheckoutContextController`: o teste exercita 401/403 com token de verdade.
 */

import type { UserModule } from '@adatechnology/user-module'

import type { RouteHandler } from '@/infra/http/router'
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { ADMIN_ONLY } from '@/modules/user/shared/User.constant'
import { validateBody } from '@/infra/http/middlewares/validateBody'
import { deliveryFeeTiersInputSchema } from '@/modules/order/shared/DeliveryFeeTiers.schema'
import type { DeliveryFeeTierRepositoryInterface } from '@/modules/order/domain/DeliveryFeeTierRepository.interface'
import type { ReplaceDeliveryFeeTiersUseCase } from '@/modules/order/application/use-cases/ReplaceDeliveryFeeTiers.use-case'

type DeliveryFeeTiersControllerDependencies = {
  readonly deliveryFeeTierRepository: DeliveryFeeTierRepositoryInterface
  readonly replaceDeliveryFeeTiersUseCase: ReplaceDeliveryFeeTiersUseCase
  readonly userModule?: UserModule
}

export class DeliveryFeeTiersController {
  constructor(private readonly dependencies: DeliveryFeeTiersControllerDependencies) {}

  handleList: RouteHandler = async (request, response) => {
    await requireSession({
      request,
      roles: ADMIN_ONLY,
      ...(this.dependencies.userModule ? { userModule: this.dependencies.userModule } : {}),
    })

    const tiers = await this.dependencies.deliveryFeeTierRepository.listOrdered()
    response.json(200, { data: tiers })
  }

  handleReplace: RouteHandler = async (request, response) => {
    const session = await requireSession({
      request,
      roles: ADMIN_ONLY,
      ...(this.dependencies.userModule ? { userModule: this.dependencies.userModule } : {}),
    })

    /*
     * `deliveryFeeTiersInputSchema` exige 1–10 faixas (T1.2) — regra pensada para o CONTEÚDO de uma
     * lista não vazia. Mas o painel PODE mandar `[]` para desligar a entrega de propósito (spec §3.1,
     * §4 item 9), e isso não é "corpo inválido": é a lista vazia, válida. Só o array vazio passa direto;
     * qualquer outro valor (inclusive corpo malformado) cai na validação normal.
     */
    const body = request.body
    const tiers = Array.isArray(body) && body.length === 0 ? [] : validateBody(deliveryFeeTiersInputSchema, body)
    const replaced = await this.dependencies.replaceDeliveryFeeTiersUseCase.execute({
      tiers,
      actorUserId: session.userId,
    })
    response.json(200, { data: replaced })
  }
}
