/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Rotas internas, chamadas apenas pelo worker-quickcart (nunca pelo cliente) —
 * erros propagam normalmente para o exception filter do Router, ao contrário do
 * Webhook.controller.ts (que engole erros por causa do reenvio da Meta). O worker
 * não é a Meta: uma resposta não-2xx aqui deve acionar o próprio retry do BullMQ.
 */

import type { RouteHandler } from '@/infra/http/router'
import { requireInternalToken } from '@/infra/http/middlewares/requireInternalToken'
import { validateBody } from '@/infra/http/middlewares/validateBody'
import type { ResumeConversationUseCase } from '@/modules/webhook/application/use-cases/ResumeConversation.use-case'
import { resumeConversationBodySchema } from './schemas/ResumeConversation.schema'

type InternalControllerDependencies = {
  readonly resumeConversationUseCase: ResumeConversationUseCase
}

export class InternalController {
  constructor(private readonly dependencies: InternalControllerDependencies) {}

  handleResumeConversation: RouteHandler = async (request, response) => {
    requireInternalToken(request)
    const input = validateBody(resumeConversationBodySchema, request.body)
    const result = await this.dependencies.resumeConversationUseCase.execute(input)
    response.json(200, { data: result })
  }
}
