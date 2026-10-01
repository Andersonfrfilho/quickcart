/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { CEP_DIGITS, CEP_MASK_CHARACTER, CEP_VISIBLE_DIGITS } from './pii.constant'

/** Ponto único de mascaramento de CEP para log (LGPD, security.md §1): `14010000` → `140*****`. */
export function maskCep(cep: string | null | undefined): string {
  const digits = cep?.replace(/\D/g, '') ?? ''
  return digits.slice(0, CEP_VISIBLE_DIGITS).padEnd(CEP_DIGITS, CEP_MASK_CHARACTER)
}
