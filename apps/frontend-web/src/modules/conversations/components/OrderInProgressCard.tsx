/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Pedido em andamento da conversa, acima do transcript. Todos os valores chegam calculados pela API: o
 * atendente tem de ver exatamente o total que o bot vai cobrar, e uma soma no navegador divergiria.
 */

import { useConversationCheckoutContextQuery } from '@/modules/conversations/hooks/useConversationCheckoutContext.query'
import { DELIVERY_LOCATION_SOURCE_LABELS, ORDER_IN_PROGRESS_TEXT } from '@/modules/conversations/shared/orderInProgress.constant'
import { DELIVERY_LABELS, PAYMENT_LABELS } from '@/modules/admin/shared/orderLabels'
import type { ConversationCheckoutContext } from '@/shared/api/api.types'

type OrderInProgressCardProps = {
  readonly whatsappNumber: string
}

function formatCents(valueInCents: number): string {
  return (valueInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function cashChangeText(checkout: ConversationCheckoutContext): string | undefined {
  if (checkout.paymentMethod !== 'cash') return undefined
  if (checkout.cashChangeForInCents === null) return ORDER_IN_PROGRESS_TEXT.NO_CASH_CHANGE
  return `${ORDER_IN_PROGRESS_TEXT.CASH_CHANGE_FOR} ${formatCents(checkout.cashChangeForInCents)}`
}

function formatKm(distanceKm: number): string {
  return String(Math.round(distanceKm * 10) / 10).replace('.', ',')
}

/**
 * Faixa, distância e fonte da cotação (spec §3.6): "até N km · X km, pelo CEP", ou sem distância na
 * estimativa pela cidade (D3). `undefined` sem faixa no contexto — entrega ainda não cotada ou retirada.
 */
function deliveryTierText(checkout: ConversationCheckoutContext): string | undefined {
  if (checkout.deliveryTierMaxKm === null) return undefined
  const sourceLabel = checkout.deliveryLocationSource ? DELIVERY_LOCATION_SOURCE_LABELS[checkout.deliveryLocationSource] : undefined
  const distancePart = checkout.deliveryDistanceKm === null ? '' : ` · ${formatKm(checkout.deliveryDistanceKm)} km`
  const sourcePart = sourceLabel ? `, ${sourceLabel}` : ''
  return `até ${formatKm(checkout.deliveryTierMaxKm)} km${distancePart}${sourcePart}`
}

type SummaryRowProps = {
  readonly label: string
  readonly value: string
  readonly isEmphasized?: boolean
}

function SummaryRow({ label, value, isEmphasized = false }: SummaryRowProps) {
  return (
    <div className={`flex justify-between gap-2 ${isEmphasized ? 'font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function OrderInProgressCard({ whatsappNumber }: OrderInProgressCardProps) {
  const { data: checkout } = useConversationCheckoutContextQuery(whatsappNumber)
  if (!checkout) return null

  const isDeliveryQuoted = checkout.deliveryFeeInCents !== null
  const deliveryFee = !isDeliveryQuoted
    ? ORDER_IN_PROGRESS_TEXT.DELIVERY_FEE_TO_CALCULATE
    : checkout.deliveryFeeInCents === 0
      ? ORDER_IN_PROGRESS_TEXT.FREE_DELIVERY
      : formatCents(checkout.deliveryFeeInCents)
  const deliveryType = checkout.deliveryType ? (DELIVERY_LABELS[checkout.deliveryType] ?? checkout.deliveryType) : ORDER_IN_PROGRESS_TEXT.NOT_CHOSEN
  const paymentMethod = checkout.paymentMethod ? (PAYMENT_LABELS[checkout.paymentMethod] ?? checkout.paymentMethod) : ORDER_IN_PROGRESS_TEXT.NOT_CHOSEN
  const cashChange = cashChangeText(checkout)
  const tierText = deliveryTierText(checkout)
  // Sem cotação, o "total" ainda não existe de verdade (spec §3.6): mostra o subtotal rotulado à parte.
  const amountDueLabel = isDeliveryQuoted ? ORDER_IN_PROGRESS_TEXT.AMOUNT_DUE : ORDER_IN_PROGRESS_TEXT.SUBTOTAL_WITHOUT_DELIVERY
  const amountDueValue = isDeliveryQuoted ? formatCents(checkout.amountDueInCents) : formatCents(checkout.subtotalInCents)

  return (
    <section aria-label={ORDER_IN_PROGRESS_TEXT.TITLE} className="m-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <h3 className="mb-2 font-semibold">{ORDER_IN_PROGRESS_TEXT.TITLE}</h3>
      <ul className="mb-2 space-y-1">
        {checkout.items.map((item, index) => (
          <li key={`${index}-${item.name}`} className="flex justify-between gap-2">
            <span>{item.quantity}x {item.name}</span>
            <span>{formatCents(item.lineTotalInCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-slate-100 pt-2">
        <SummaryRow label={ORDER_IN_PROGRESS_TEXT.SUBTOTAL} value={formatCents(checkout.subtotalInCents)} />
        <SummaryRow label={ORDER_IN_PROGRESS_TEXT.DELIVERY_FEE} value={tierText ? `${deliveryFee} (${tierText})` : deliveryFee} />
        <SummaryRow label={amountDueLabel} value={amountDueValue} isEmphasized />
        <SummaryRow label={ORDER_IN_PROGRESS_TEXT.DELIVERY_TYPE} value={checkout.address ? `${deliveryType} — ${checkout.address}` : deliveryType} />
        <SummaryRow label={ORDER_IN_PROGRESS_TEXT.PAYMENT_METHOD} value={cashChange ? `${paymentMethod} (${cashChange})` : paymentMethod} />
      </dl>
    </section>
  )
}
