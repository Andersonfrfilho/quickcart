/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import Redis from 'ioredis'
import { environment } from '@/infra/config/environment'

// BullMQ exige maxRetriesPerRequest: null.
export const queueConnection = new Redis(environment.REDIS_URL, {
  maxRetriesPerRequest: null,
})
