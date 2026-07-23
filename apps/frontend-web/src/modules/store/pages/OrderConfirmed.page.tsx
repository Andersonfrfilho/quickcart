import React from 'react'
import { useRouter } from '@/app/router'
import { Card, Button } from '@/components/ui'

export function OrderConfirmedPage() {
  const { navigate } = useRouter()

  return (
    <div className="max-w-md mx-auto py-12">
      <Card className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Pedido confirmado!</h2>
        <p className="text-muted-foreground mb-6">
          Seu pedido foi recebido e está sendo preparado. Você receberá atualizações pelo WhatsApp.
        </p>
        <Button onClick={() => navigate('/')}>Voltar para loja</Button>
      </Card>
    </div>
  )
}
