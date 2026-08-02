import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@/app/router'
import { useRequireAdmin } from '@/modules/admin/shared/useAdminAuth.hook'
import { useUpdateOrderStatusMutation } from '@/modules/admin/shared/mutations/useUpdateOrderStatus.mutation'
import { useSetOrderItemUnavailableMutation } from '@/modules/admin/shared/mutations/useSetOrderItemUnavailable.mutation'
import { adminGetOrderDetail } from '@/shared/api/client'

/**
 * Itens já separados, por pedido, guardados no aparelho.
 *
 * É marcação de trabalho em andamento, não estado do pedido: quem separa vai ao corredor, volta, atende
 * alguém e precisa achar onde parou. Fica no `localStorage` e não no servidor de propósito — virar
 * campo do pedido faria a marca de duas pessoas separando o mesmo pedido brigar entre si, e "separado"
 * não é um fato sobre a compra, é sobre o turno de quem está com ela na mão.
 */
const PICKED_ITEMS_STORAGE_PREFIX = 'quickcart:picked-items:'

function readPickedItems(orderId: string): readonly string[] {
  try {
    const raw = window.localStorage.getItem(`${PICKED_ITEMS_STORAGE_PREFIX}${orderId}`)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    // Armazenamento indisponível ou conteúdo corrompido: começa do zero em vez de derrubar a tela.
    return []
  }
}

function writePickedItems(orderId: string, itemIds: readonly string[]): void {
  try {
    window.localStorage.setItem(`${PICKED_ITEMS_STORAGE_PREFIX}${orderId}`, JSON.stringify(itemIds))
  } catch {
    // Sem persistir. A marcação continua valendo nesta sessão da tela.
  }
}

export function useAdminOrderDetailPage() {
  const token = useRequireAdmin()
  const { params, navigate } = useRouter()
  const orderId = params.id ?? ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-order-detail', orderId],
    queryFn: () => adminGetOrderDetail(token as string, orderId),
    enabled: !!token && orderId.length > 0,
  })

  const updateStatusMutation = useUpdateOrderStatusMutation(token)
  const setUnavailableMutation = useSetOrderItemUnavailableMutation(token)

  const [pickedItemIds, setPickedItemIds] = React.useState<readonly string[]>([])
  const [hidePickedItems, setHidePickedItems] = React.useState(false)

  // Relê ao trocar de pedido: a marcação é por pedido, e carregar a do anterior mostraria itens
  // separados que ninguém separou.
  React.useEffect(() => {
    setPickedItemIds(orderId ? readPickedItems(orderId) : [])
    setHidePickedItems(false)
  }, [orderId])

  function togglePicked(itemId: string) {
    setPickedItemIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
      writePickedItems(orderId, next)
      return next
    })
  }

  function clearPicked() {
    setPickedItemIds([])
    writePickedItems(orderId, [])
  }

  const order = data?.data
  const items = order?.items ?? []
  const pickedCount = items.filter((item) => pickedItemIds.includes(item.id)).length
  const visibleItems = hidePickedItems ? items.filter((item) => !pickedItemIds.includes(item.id)) : items

  function updateStatus(status: string) {
    updateStatusMutation.mutate({ id: orderId, status })
  }

  function setUnavailable({ itemId, unavailable }: { itemId: string; unavailable: boolean }) {
    setUnavailableMutation.mutate({ orderId, itemId, unavailable })

    // Item que acabou não fica marcado como separado: são estados que se excluem, e deixar as duas
    // marcas juntas faria o progresso contar como pronto algo que não vai na sacola.
    if (unavailable) togglePickedOff(itemId)
  }

  function togglePickedOff(itemId: string) {
    setPickedItemIds((current) => {
      if (!current.includes(itemId)) return current
      const next = current.filter((id) => id !== itemId)
      writePickedItems(orderId, next)
      return next
    })
  }

  return {
    token,
    order,
    items,
    visibleItems,
    isLoading,
    isError,
    pickedItemIds,
    pickedCount,
    togglePicked,
    clearPicked,
    hidePickedItems,
    setHidePickedItems,
    updateStatus,
    isUpdatingStatus: updateStatusMutation.isPending,
    setUnavailable,
    pendingUnavailableItemId: setUnavailableMutation.isPending
      ? setUnavailableMutation.variables?.itemId
      : undefined,
    goBackToList: () => navigate('/admin/orders'),
  }
}
