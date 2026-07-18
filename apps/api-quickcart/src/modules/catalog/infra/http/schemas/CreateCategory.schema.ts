/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().default(0),
  emoji: z.string().max(8).optional(),
})
