/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Até a T2.1 existir (taxa de entrega, spec §3.4), o total a pagar é só o total dos
 * itens do carrinho. Isolado numa função própria para a T2.1 trocar a soma sem tocar
 * em quem valida o troco.
 */

export function calculateAmountDueInCents(cartTotalInCents: number): number {
  return cartTotalInCents
}
