/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { Badge } from '@/components/ui'

type OrderPaymentNotesProps = {
  readonly cashChangeForInCents: number | null
  readonly requiresCardMachine: boolean
}

function formatMoney(totalInCents: number): string {
  return (totalInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** O que quem entrega precisa levar: troco pedido e maquininha. Os dois vêm prontos do backend. */
export function OrderPaymentNotes({ cashChangeForInCents, requiresCardMachine }: OrderPaymentNotesProps) {
  return (
    <>
      {/* Só aparece em dinheiro com troco pedido — "Não preciso" grava `null`, e a linha some. */}
      {cashChangeForInCents !== null && <p className="mt-0.5 text-sm">Troco para {formatMoney(cashChangeForInCents)}</p>}
      {/* `requiresCardMachine` — nunca na retirada (roteiro §11, spec §3.2). */}
      {requiresCardMachine && (
        <Badge className="mt-1.5" variant="outline">
          🧾 Levar maquininha
        </Badge>
      )}
    </>
  )
}
