/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Controller próprio, fora do `ConversationController`: este depende do carrinho e do catálogo, que o
 * outro não conhece, e o `userModule` injetável deixa o teste exercitar 401/403 com token de verdade.
 */

import type { UserModule } from '@adatechnology/user-module'

import type { RouteHandler } from '@/infra/http/router'
import { requireSession } from '@/infra/http/middlewares/requireSession'
import { ADMIN_AND_ATTENDANT } from '@/modules/user/shared/User.constant'
import { ValidationError } from '@/shared/errors/AppError.error'
import { VALIDATION_ERROR } from '@/shared/errors/codes'
import type {
  GetConversationCheckoutContextParams,
  GetConversationCheckoutContextResult,
} from '@/modules/conversation/application/types/GetConversationCheckoutContext.types'

type ConversationCheckoutContextControllerDependencies = {
  readonly getConversationCheckoutContextUseCase: {
    execute(params: GetConversationCheckoutContextParams): Promise<GetConversationCheckoutContextResult>
  }
  readonly userModule?: UserModule
}

export class ConversationCheckoutContextController {
  constructor(private readonly dependencies: ConversationCheckoutContextControllerDependencies) {}

  handleGetCheckoutContext: RouteHandler = async (request, response) => {
    await requireSession({
      request,
      roles: ADMIN_AND_ATTENDANT,
      ...(this.dependencies.userModule ? { userModule: this.dependencies.userModule } : {}),
    })
    const whatsappNumber = request.params[0]
    if (!whatsappNumber) throw new ValidationError('Número de WhatsApp ausente na rota', VALIDATION_ERROR)

    const checkoutContext = await this.dependencies.getConversationCheckoutContextUseCase.execute({ whatsappNumber })
    response.json(200, { data: checkoutContext ?? null })
  }
}
