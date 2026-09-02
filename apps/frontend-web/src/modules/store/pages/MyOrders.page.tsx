import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'

import { useRouter } from '@/app/router'
import { useMyOrdersPage } from '@/modules/store/hooks/useMyOrdersPage.hook'
import { ORDER_STATUS_LABELS } from '@/modules/admin/shared/orderStatusStyle'

function formatPrice(totalInCents: number): string {
  return (totalInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function MyOrdersPage() {
  const { navigate } = useRouter()
  const { isAuthenticated, isLoading, orders } = useMyOrdersPage()

  if (!isAuthenticated) return null

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Meus pedidos</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && orders.length === 0 && (
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não fez nenhum pedido por aqui.</p>
            <Button onClick={() => navigate('/')}>Ver produtos</Button>
          </CardContent>
        </Card>
      )}

      {orders.map((order) => (
        <Card key={order.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">#{order.shortCode}</CardTitle>
            <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
            <span className="font-medium">{formatPrice(order.totalInCents)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
