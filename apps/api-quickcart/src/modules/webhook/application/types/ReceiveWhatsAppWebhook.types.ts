/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { WhatsAppWebhookPayload } from './WhatsAppWebhookPayload.types'

export type ReceiveWhatsAppWebhookParams = {
  readonly payload: WhatsAppWebhookPayload
}

export type ReceiveWhatsAppWebhookResult = {
  readonly processedCount: number
  readonly duplicateCount: number
  readonly statusUpdateCount: number
}
