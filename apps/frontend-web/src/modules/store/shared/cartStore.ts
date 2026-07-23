import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CartItem = {
  productId: string
  name: string
  brand: string | null
  unitSize: string | null
  priceInCents: number
  quantity: number
  imageUrl: string | null
}

type CartStore = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  totalInCents: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const qty = item.quantity ?? 1
          const existing = state.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity: qty }] }
        }),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) return { items: state.items.filter((i) => i.productId !== productId) }
          return {
            items: state.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
          }
        }),
      clearCart: () => set({ items: [] }),
      totalInCents: () => get().items.reduce((sum, i) => sum + i.priceInCents * i.quantity, 0),
    }),
    { name: 'quickcart-cart' },
  ),
)
