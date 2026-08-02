import axios from 'axios'
import type {
  ApiCollectionResponse,
  ApiItemResponse,
  ApiListResponse,
  Category,
  DeliveryType,
  Order,
  OrderSortableField,
  PaymentMethod,
  Product,
  ProductSortableField,
  ReceiptPreference,
  OrderDetail,
  SortDirection,
  UnmatchedDemand,
  UnmatchedDemandSortableField,
} from '@/shared/api/api.types'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error?.message ?? 'Erro inesperado'
    return Promise.reject(new Error(message))
  },
)

export { apiClient }

export type ListProductsParams = {
  categoryId?: string
  page?: number
  perPage?: number
  sortBy?: ProductSortableField
  sortDirection?: SortDirection
}

export type CreateOrderInput = {
  customer: { name: string; phone: string; email?: string }
  items: { productId: string; quantity: number }[]
  deliveryType: DeliveryType
  address?: { street: string }
  paymentMethod: PaymentMethod
  receiptPreference: ReceiptPreference
}

export type ListAdminOrdersParams = {
  page?: number
  perPage?: number
  status?: string[]
  /** Nome, telefone ou código — o servidor procura nos três. */
  search?: string
  deliveryType?: string[]
  paymentMethod?: string[]
  sortBy?: OrderSortableField
  sortDirection?: SortDirection
}

export type ListAdminProductsParams = {
  page?: number
  perPage?: number
  categoryId?: string[]
  sortBy?: ProductSortableField
  sortDirection?: SortDirection
}

export async function getCategories(): Promise<ApiCollectionResponse<Category>> {
  return apiClient.get('/v1/categories')
}

export async function getProducts(params: ListProductsParams): Promise<ApiListResponse<Product>> {
  return apiClient.get('/v1/products', { params })
}

export async function searchProducts(query: string, limit = 8): Promise<ApiCollectionResponse<Product>> {
  return apiClient.get('/v1/products/search', { params: { query, limit } })
}

export async function createOrder(body: CreateOrderInput, idempotencyKey: string): Promise<ApiItemResponse<{ shortCode: string }>> {
  return apiClient.post('/v1/orders', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export async function getOrderStatus(shortCode: string, phone: string): Promise<ApiItemResponse<Order>> {
  return apiClient.get(`/v1/orders/${shortCode}`, { params: { phone } })
}

export async function adminListCategories(token: string): Promise<ApiCollectionResponse<Category>> {
  return apiClient.get('/v1/admin/categories', { headers: { Authorization: `Bearer ${token}` } })
}

export async function adminListProducts(token: string, params: ListAdminProductsParams = {}): Promise<ApiListResponse<Product>> {
  const { categoryId, ...rest } = params
  return apiClient.get('/v1/admin/products', {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...rest, categoryId: categoryId && categoryId.length > 0 ? categoryId.join(',') : undefined },
  })
}

export async function adminCreateProduct(token: string, body: unknown): Promise<ApiItemResponse<Product>> {
  return apiClient.post('/v1/admin/products', body, { headers: { Authorization: `Bearer ${token}` } })
}

export async function adminUpdateProduct(token: string, id: string, body: unknown): Promise<ApiItemResponse<Product>> {
  return apiClient.put(`/v1/admin/products/${id}`, body, { headers: { Authorization: `Bearer ${token}` } })
}

export async function adminAdjustStock(token: string, id: string, body: { delta: number }): Promise<ApiItemResponse<Product>> {
  return apiClient.patch(`/v1/admin/products/${id}/stock`, body, { headers: { Authorization: `Bearer ${token}` } })
}

export type ListUnmatchedDemandsParams = {
  limit?: number
  windowDays?: number
  /** Origens do pedido sem resposta; múltiplas porque "não temos" e "acabou" se leem juntas. */
  source?: string[]
  search?: string
  sortBy?: UnmatchedDemandSortableField
  sortDirection?: SortDirection
}

export type UnmatchedDemandsResponse = {
  readonly data: readonly UnmatchedDemand[]
  readonly meta: { readonly windowDays: number; readonly since: string }
}

export async function adminListUnmatchedDemands(
  token: string,
  params: ListUnmatchedDemandsParams = {},
): Promise<UnmatchedDemandsResponse> {
  return apiClient.get('/v1/admin/demands/unmatched', {
    headers: { Authorization: `Bearer ${token}` },
    params,
  })
}

/** Lista vazia vira `undefined`: mandar `status=` sem valor faria o servidor filtrar por nada. */
function toCsvParam(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(',') : undefined
}

export async function adminListOrders(token: string, params: ListAdminOrdersParams = {}): Promise<ApiListResponse<Order>> {
  const { status, deliveryType, paymentMethod, search, ...rest } = params
  return apiClient.get('/v1/admin/orders', {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      ...rest,
      status: toCsvParam(status),
      deliveryType: toCsvParam(deliveryType),
      paymentMethod: toCsvParam(paymentMethod),
      search: search && search.trim().length > 0 ? search.trim() : undefined,
    },
  })
}

export async function adminGetOrderDetail(token: string, id: string): Promise<ApiItemResponse<OrderDetail>> {
  return apiClient.get(`/v1/admin/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
}

export async function adminSetOrderItemUnavailable(
  token: string,
  params: { readonly orderId: string; readonly itemId: string; readonly unavailable: boolean },
): Promise<ApiItemResponse<OrderDetail>> {
  return apiClient.patch(
    `/v1/admin/orders/${params.orderId}/items/${params.itemId}/unavailable`,
    { unavailable: params.unavailable },
    { headers: { Authorization: `Bearer ${token}` } },
  )
}

export async function adminUpdateOrderStatus(token: string, id: string, status: string): Promise<ApiItemResponse<Order>> {
  return apiClient.patch(`/v1/admin/orders/${id}/status`, { status }, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
