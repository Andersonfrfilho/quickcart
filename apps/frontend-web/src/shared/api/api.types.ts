export type Pagination = {
  readonly total: number
  readonly page: number
  readonly perPage: number
}

export type ApiListResponse<TItem> = {
  readonly data: TItem[]
  readonly pagination: Pagination
}

export type ApiCollectionResponse<TItem> = {
  readonly data: TItem[]
}

export type ApiItemResponse<TItem> = {
  readonly data: TItem
}

export type Category = {
  readonly id: string
  readonly name: string
  readonly emoji: string | null
}

export type Product = {
  readonly id: string
  readonly categoryId: string
  readonly name: string
  readonly brand: string | null
  readonly unitSize: string | null
  readonly priceInCents: number
  readonly stockQuantity: number
  readonly isAvailable: boolean
  readonly imageUrl: string | null
}

export const ORDER_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  READY_FOR_PICKUP: 'ready_for_pickup',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export type DeliveryType = 'delivery' | 'pickup'
export type PaymentMethod = 'pix' | 'card_on_delivery' | 'cash'
export type ReceiptPreference = 'whatsapp' | 'email' | 'both'

export type Order = {
  readonly id: string
  readonly shortCode: string
  readonly customerName: string | null
  readonly customerPhone: string
  readonly totalInCents: number
  readonly status: OrderStatus
  readonly deliveryType: DeliveryType
  readonly paymentMethod: PaymentMethod
  readonly createdAt: string
}

export const PRODUCT_SORTABLE_FIELDS = ['name', 'priceInCents', 'stockQuantity', 'createdAt'] as const
export type ProductSortableField = (typeof PRODUCT_SORTABLE_FIELDS)[number]

export const ORDER_SORTABLE_FIELDS = ['createdAt', 'totalInCents', 'status'] as const
export type OrderSortableField = (typeof ORDER_SORTABLE_FIELDS)[number]

export type SortDirection = 'asc' | 'desc'
