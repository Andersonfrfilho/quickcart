/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Usado quando GROQ_API_KEY não está configurada — o processor de STT trata
 * undefined como "não foi possível transcrever" e resume a conversa com
 * transcript: null, disparando AUDIO_NOT_SUPPORTED_YET (ver docs/API.md).
 */

import type { SttProvider } from '@/modules/stt/application/providers/SttProvider.interface'

export class NullSttProvider implements SttProvider {
  async transcribe(): Promise<string | undefined> {
    return undefined
  }
}
