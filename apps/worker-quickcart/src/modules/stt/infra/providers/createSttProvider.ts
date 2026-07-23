/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { environment } from '@/infra/config/environment'
import type { SttProvider } from '@/modules/stt/application/providers/SttProvider.interface'
import { GroqSttProvider } from '@/modules/stt/infra/providers/GroqSttProvider'
import { NullSttProvider } from '@/modules/stt/infra/providers/NullSttProvider'

export function createSttProvider(): SttProvider {
  return environment.GROQ_API_KEY ? new GroqSttProvider() : new NullSttProvider()
}

export const sttProvider = createSttProvider()
