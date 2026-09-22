/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ponto único de mascaramento de telefone para log (LGPD): a defesa vive no
 * logger, não na disciplina de quem escreve o log. Mantém só os 4 últimos
 * dígitos — o suficiente para correlacionar um atendimento sem expor o número.
 */

const VISIBLE_DIGITS = 4
const MASK_PREFIX = '****'

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return MASK_PREFIX

  const digits = phone.replace(/\D/g, '')
  if (digits.length <= VISIBLE_DIGITS) return MASK_PREFIX

  return `${MASK_PREFIX}${digits.slice(-VISIBLE_DIGITS)}`
}
