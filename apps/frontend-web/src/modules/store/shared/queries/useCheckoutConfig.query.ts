/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useQuery } from '@tanstack/react-query'
import { getCheckoutConfig } from '@/shared/api/client'

export function useCheckoutConfigQuery() {
  return useQuery({ queryKey: ['checkout-config'], queryFn: getCheckoutConfig })
}
