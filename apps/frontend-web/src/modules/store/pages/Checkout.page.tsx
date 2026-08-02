import React from 'react'
import { useRouter } from '@/app/router'
import { useCheckoutPage } from '@/modules/store/hooks/useCheckoutPage.hook'
import { Card, Button, Input } from '@/components/ui'

export function CheckoutPage() {
  const { navigate } = useRouter()
  const {
    items,
    totalInCents,
    name,
    setName,
    phone,
    setPhone,
    email,
    setEmail,
    deliveryType,
    setDeliveryType,
    cep,
    setCep,
    handleCepBlur,
    isLookingUpCep,
    street,
    setStreet,
    number,
    setNumber,
    complement,
    setComplement,
    neighborhood,
    setNeighborhood,
    city,
    setCity,
    addressState,
    setAddressState,
    reference,
    setReference,
    paymentMethod,
    setPaymentMethod,
    receiptPreference,
    setReceiptPreference,
    error,
    loading,
    handleSubmit,
  } = useCheckoutPage()

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carrinho vazio</p>
        <Button variant="link" onClick={() => navigate('/')}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Finalizar compra</h2>

      <Card className="p-4">
        <h3 className="font-medium mb-3">Resumo</h3>
        {items.map((item) => (
          <div key={item.productId} className="flex justify-between text-sm py-1">
            <span>{item.quantity}x {item.name}</span>
            <span>{((item.priceInCents * item.quantity) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        ))}
        <div className="flex justify-between font-semibold text-lg mt-3 pt-3 border-t">
          <span>Total</span>
          <span className="text-primary">{(totalInCents() / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome</label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Telefone (WhatsApp)</label>
          <Input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">E-mail (opcional)</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de entrega</label>
          <div className="flex gap-2">
            <Button type="button" variant={deliveryType === 'delivery' ? 'default' : 'outline'} onClick={() => setDeliveryType('delivery')}>
              Delivery
            </Button>
            <Button type="button" variant={deliveryType === 'pickup' ? 'default' : 'outline'} onClick={() => setDeliveryType('pickup')}>
              Retirada
            </Button>
          </div>
        </div>

        {deliveryType === 'delivery' && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">CEP</label>
              <Input
                required
                inputMode="numeric"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                onBlur={() => void handleCepBlur()}
              />
              {/* CEP que não resolve não bloqueia nada — os campos abaixo continuam editáveis à mão. */}
              {isLookingUpCep && <p className="text-xs text-muted-foreground">Buscando endereço…</p>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Rua</label>
                <Input required value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Número</label>
                <Input required placeholder="s/n" value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Complemento (opcional)</label>
              <Input
                placeholder="apto, bloco…"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Bairro</label>
                <Input required value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">UF</label>
                <Input
                  required
                  maxLength={2}
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cidade</label>
              <Input required value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ponto de referência (opcional)</label>
              <Input
                placeholder="portão azul ao lado da padaria"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Pagamento</label>
          <div className="flex gap-2">
            <Button type="button" variant={paymentMethod === 'pix' ? 'default' : 'outline'} onClick={() => setPaymentMethod('pix')}>Pix</Button>
            <Button type="button" variant={paymentMethod === 'card_on_delivery' ? 'default' : 'outline'} onClick={() => setPaymentMethod('card_on_delivery')}>Cartão</Button>
            <Button type="button" variant={paymentMethod === 'cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('cash')}>Dinheiro</Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Comprovante</label>
          <div className="flex gap-2">
            <Button type="button" variant={receiptPreference === 'whatsapp' || receiptPreference === 'both' ? 'default' : 'outline'} onClick={() => setReceiptPreference('whatsapp')}>WhatsApp</Button>
            <Button type="button" variant={receiptPreference === 'email' || receiptPreference === 'both' ? 'default' : 'outline'} onClick={() => setReceiptPreference('email')}>E-mail</Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? 'Processando...' : 'Confirmar pedido'}
        </Button>
      </form>
    </div>
  )
}
