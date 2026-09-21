import React from 'react'
import { useUser, SESSION_STATUS } from '@adatechnology/user-ui'
import { useRouter } from '@/app/router'
import { useCartStore } from '@/modules/store/shared/cartStore'
import { useCreateOrderMutation } from '@/modules/store/shared/mutations/useCreateOrder.mutation'
import { lookupAddressByCep } from '@/modules/store/shared/viaCepLookup'
import type { DeliveryType, PaymentMethod, ReceiptPreference } from '@/shared/api/api.types'

const SIGN_IN_PATH = '/entrar'

export function useCheckoutPage() {
  const { navigate } = useRouter()
  const { status, user } = useUser()
  const { items, totalInCents, clearCart } = useCartStore()
  const createOrderMutation = useCreateOrderMutation()

  /*
   * Navegar na loja é livre; FECHAR o pedido exige conta. A trava fica aqui, no checkout, e não na
   * loja inteira: exigir login para ver preço afasta quem ainda está decidindo.
   *
   * `loading` não redireciona — expulsaria quem está com a sessão sendo restaurada no reload.
   */
  React.useEffect(() => {
    if (status === SESSION_STATUS.UNAUTHENTICATED) navigate(SIGN_IN_PATH)
  }, [status, navigate])

  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')

  // Prefill do perfil: quem acabou de entrar não deve redigitar o que a conta já sabe.
  React.useEffect(() => {
    if (!user) return
    setName((current) => current || user.name)
    setEmail((current) => current || user.email)
  }, [user])
  const [deliveryType, setDeliveryType] = React.useState<DeliveryType>('delivery')

  /*
   * CEP primeiro, com auto-preenchimento (spec §8 Q1). O cliente digita 8 dígitos, o ViaCEP devolve
   * rua/bairro/cidade/UF, e ele completa só número e complemento — menos digitação, e o endereço já
   * nasce estruturado em vez de um texto que alguém teria de interpretar depois.
   *
   * CEP que não resolve NÃO trava: os campos ficam vazios e editáveis manualmente, o caminho de
   * dados é um só — o que muda é de onde os campos vêm preenchidos.
   */
  const [cep, setCep] = React.useState('')
  const [street, setStreet] = React.useState('')
  const [number, setNumber] = React.useState('')
  const [complement, setComplement] = React.useState('')
  const [neighborhood, setNeighborhood] = React.useState('')
  const [city, setCity] = React.useState('')
  const [addressState, setAddressState] = React.useState('')
  const [reference, setReference] = React.useState('')
  const [isLookingUpCep, setIsLookingUpCep] = React.useState(false)

  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('pix')
  const [receiptPreference, setReceiptPreference] = React.useState<ReceiptPreference>('whatsapp')
  const [error, setError] = React.useState<string | null>(null)

  async function handleCepBlur() {
    const digitsOnly = cep.replace(/\D/g, '')
    if (digitsOnly.length !== 8) return

    setIsLookingUpCep(true)
    const found = await lookupAddressByCep(cep)
    setIsLookingUpCep(false)
    if (!found) return

    setStreet(found.street)
    setNeighborhood(found.neighborhood)
    setCity(found.city)
    setAddressState(found.state)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    try {
      await createOrderMutation.mutateAsync({
        body: {
          // Sem `phone`: a api usa o da conta logada, e mandar outro não teria efeito nenhum.
          customer: { name, ...(email ? { email } : {}) },
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          deliveryType,
          ...(deliveryType === 'delivery'
            ? {
                address: {
                  cep,
                  street,
                  number,
                  ...(complement ? { complement } : {}),
                  neighborhood,
                  city,
                  state: addressState,
                  ...(reference ? { reference } : {}),
                },
              }
            : {}),
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
    loading: createOrderMutation.isPending,
    handleSubmit,
  }
}
