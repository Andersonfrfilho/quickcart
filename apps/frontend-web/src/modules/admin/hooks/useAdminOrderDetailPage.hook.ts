import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@/app/router'
import { useRequireStaff } from '@/modules/auth/shared/useSession.hook'
import { STAFF_ROLES } from '@/modules/auth/shared/roles.constant'
import { useUpdateOrderStatusMutation } from '@/modules/admin/shared/mutations/useUpdateOrderStatus.mutation'
import { useSetOrderItemUnavailableMutation } from '@/modules/admin/shared/mutations/useSetOrderItemUnavailable.mutation'
import { useNotifyUnavailableItemsMutation } from '@/modules/admin/shared/mutations/useNotifyUnavailableItems.mutation'
import { useSetOrderItemPickedMutation } from '@/modules/admin/shared/mutations/useSetOrderItemPicked.mutation'
import { adminGetOrderDetail } from '@/shared/api/client'

export function useAdminOrderDetailPage() {
  const { isReady } = useRequireStaff(STAFF_ROLES)
  const { params, navigate } = useRouter()
  const orderId = params.id ?? ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-order-detail', orderId],
    queryFn: () => adminGetOrderDetail(orderId),
    enabled: orderId.length > 0,
  })

  const updateStatusMutation = useUpdateOrderStatusMutation()
  const setUnavailableMutation = useSetOrderItemUnavailableMutation()
  const notifyUnavailableMutation = useNotifyUnavailableItemsMutation()
  const setPickedMutation = useSetOrderItemPickedMutation()

  const [hidePickedItems, setHidePickedItems] = React.useState(false)

  // "Esconder separados" é preferência de quem está olhando agora, não fato do pedido — continua local,
  // e volta ao normal ao trocar de pedido.
  React.useEffect(() => {
    setHidePickedItems(false)
  }, [orderId])

  const order = data?.data
  const items = order?.items ?? []

  /**
   * A marcação vem do SERVIDOR (`pickedAt`), não de estado local.
   *
   * Era `localStorage` por aparelho: separar no tablet do balcão e abrir no celular mostrava "0/2
   * separados" num pedido cuja esteira já dizia "Separado", e quem chegava depois não tinha como saber
   * qual das duas era verdade.
   */
  const pickedItemIds = items.filter((item) => item.pickedAt !== null).map((item) => item.id)
  const pickedCount = pickedItemIds.length
  const visibleItems = hidePickedItems ? items.filter((item) => item.pickedAt === null) : items

  function togglePicked(itemId: string) {
    const item = items.find((candidate) => candidate.id === itemId)
    if (!item) return
    setPickedMutation.mutate({ orderId, itemId, picked: item.pickedAt === null })
  }

  /** Uma requisição para todos: o servidor deixa item em falta de fora, que é onde a regra pertence. */
  function pickAll() {
    setPickedMutation.mutate({ orderId, picked: true })
  }

  function clearPicked() {
    setPickedMutation.mutate({ orderId, picked: false })
  }

  function updateStatus(status: string) {
    updateStatusMutation.mutate({ id: orderId, status })
  }

  function setUnavailable({ itemId, unavailable }: { itemId: string; unavailable: boolean }) {
    setUnavailableMutation.mutate({ orderId, itemId, unavailable })

    /*
     * Item que acabou não fica marcado como separado: são estados que se excluem, e deixar as duas
     * marcas juntas faria o progresso contar como pronto algo que não vai na sacola. Vai ao servidor
     * também, senão a contradição só desapareceria neste aparelho.
     */
    if (unavailable) setPickedMutation.mutate({ orderId, itemId, picked: false })
  }

  return {
    isReady,
    notifyUnavailable: () => notifyUnavailableMutation.mutate(orderId),
    isNotifyingUnavailable: notifyUnavailableMutation.isPending,
    /**
     * Abre a conversa daquele cliente na inbox.
     *
     * A inbox seleciona por `?number=`, então basta o telefone do pedido — sem isso, quem quer explicar a
     * falta por escrito precisa copiar o número e procurar na lista de conversas.
     */
    openConversation: () =>
      order ? navigate(`/admin/conversations?number=${encodeURIComponent(order.customerPhone)}`) : undefined,
    order,
    items,
    visibleItems,
    isLoading,
    isError,
    pickedItemIds,
    pickedCount,
    togglePicked,
    clearPicked,
    pickAll,
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
