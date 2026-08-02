import { useAdminOrderDetailPage } from '@/modules/admin/hooks/useAdminOrderDetailPage.hook'
import { OrderDetailView } from '@/modules/admin/components/OrderDetailView'
import { Button } from '@/components/ui'

/**
 * Só liga o hook na tela. O desenho vive em `OrderDetailView`, que renderiza também no preview de dev
 * com pedido de mentira — é assim que dá para ajustar layout sem depender de um pedido real na base.
 */
export function AdminOrderDetailPage() {
  const {
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
    isUpdatingStatus,
    setUnavailable,
    pendingUnavailableItemId,
    goBackToList,
  } = useAdminOrderDetailPage()

  if (!token) return null

  if (isLoading) return <p className="p-6 text-muted-foreground">Carregando pedido…</p>

  if (isError || !order) {
    return (
      <div className="space-y-4 p-6">
        <p>Pedido não encontrado.</p>
        <Button variant="outline" onClick={goBackToList}>
          Voltar para a lista
        </Button>
      </div>
    )
  }

  return (
    <OrderDetailView
      order={order}
      items={items}
      visibleItems={visibleItems}
      pickedItemIds={pickedItemIds}
      pickedCount={pickedCount}
      hidePickedItems={hidePickedItems}
      isUpdatingStatus={isUpdatingStatus}
      onTogglePicked={togglePicked}
      onClearPicked={clearPicked}
      onToggleHidePicked={setHidePickedItems}
      onUpdateStatus={updateStatus}
      onSetUnavailable={setUnavailable}
      pendingUnavailableItemId={pendingUnavailableItemId}
      onBack={goBackToList}
    />
  )
}
