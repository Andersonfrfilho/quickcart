/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { Router } from '@/infra/http/router'
import type { FixedWindowRateLimiter } from '@/infra/http/rate-limit/FixedWindowRateLimiter'
import { CHECKOUT_QUOTE_MAX_BODY_BYTES } from '@/modules/store/shared/Store.constant'

import type { StoreController } from './Store.controller'

export type RegisterStoreRoutesParams = {
  readonly router: Router
  readonly storeController: StoreController
  readonly checkoutQuoteRateLimiter: FixedWindowRateLimiter
}

export function registerStoreRoutes(params: RegisterStoreRoutesParams): void {
  params.router.post('/v1/store/register', params.storeController.handleRegister)
  params.router.get('/v1/store/orders', params.storeController.handleListMyOrders)
  // Pública e sem sessão: teto de corpo e limite por IP só aqui (upload de mídia precisa de corpo grande).
  params.router.post(
    '/v1/store/checkout-quote',
    params.checkoutQuoteRateLimiter.protect(params.storeController.handleGetCheckoutQuote),
    { maxBodyBytes: CHECKOUT_QUOTE_MAX_BODY_BYTES },
  )
}
