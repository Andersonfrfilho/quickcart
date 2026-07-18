/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { HealthCheckerInterface } from '@/shared/providers/HealthChecker.interface'
import { pingDatabase } from './connection'

export class DatabaseHealthChecker implements HealthCheckerInterface {
  async ping(): Promise<boolean> {
    return pingDatabase()
  }
}
