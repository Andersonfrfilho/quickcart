import { useState } from 'react'
import { useRouter } from '@/app/router'
import { useCartStore } from '@/modules/store/shared/cartStore'
import { useCreateOrderMutation } from '@/modules/store/shared/mutations/useCreateOrder.mutation'
import type { DeliveryType, PaymentMethod, ReceiptPreference } from '@/shared/api/api.types'

export function useCheckoutPage() {
  const { navigate } = useRouter()
  const { items, totalInCents, clearCart } = useCartStore()
  const createOrderMutation = useCreateOrderMutation()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [receiptPreference, setReceiptPreference] = useState<ReceiptPreference>('whatsapp')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    try {
      await createOrderMutation.mutateAsync({
        body: {
          customer: { name, phone, ...(email ? { email } : {}) },
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          deliveryType,
          ...(deliveryType === 'delivery' ? { address: { street: address } } : {}),
          paymentMethod,
          receiptPreference,
        },
        idempotencyKey: crypto.randomUUID(),
      })

      clearCart()
      navigate('/order-confirmed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar pedido'
      setError(message)
    }
  }

  return {
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
    address,
    setAddress,
    paymentMethod,
    setPaymentMethod,
    receiptPreference,
    setReceiptPreference,
    error,
    loading: createOrderMutation.isPending,
    handleSubmit,
  }
}
