import React from 'react'
import { useRouter } from '@/app/router'
import { useCartStore } from '@/modules/store/shared/cartStore'
import { Card, Button } from '@/components/ui'

export function CartPage() {
  const { navigate } = useRouter()
  const { items, removeItem, updateQuantity, totalInCents } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg mb-4">Seu carrinho está vazio</p>
        <Button onClick={() => navigate('/')}>Ver produtos</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Carrinho</h2>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.productId} className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-medium">{item.name}</h3>
                {item.brand && <p className="text-sm text-muted-foreground">{item.brand}</p>}
                <p className="text-sm text-primary font-medium mt-1">
                  {(item.priceInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                >
                  -
                </Button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                >
                  +
                </Button>
              </div>
              <div className="text-right min-w-[80px]">
                <p className="font-semibold text-primary">
                  {((item.priceInCents * item.quantity) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.productId)}
                  className="text-destructive text-xs mt-1"
                >
                  Remover
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-2xl font-bold text-primary">
            {(totalInCents() / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        <Button onClick={() => navigate('/checkout')} className="w-full" size="lg">
          Finalizar compra
        </Button>
      </Card>
    </div>
  )
}
