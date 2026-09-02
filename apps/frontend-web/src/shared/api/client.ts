import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
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
import { getAccessToken, refreshSession } from '@/modules/auth/shared/sessionStore'

const UNAUTHORIZED_STATUS = 401

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/',
  headers: { 'Content-Type': 'application/json' },
})

/*
 * O token entra aqui, e não em cada chamada, porque ele ROTACIONA: um token passado por parâmetro
 * fica preso na closure do react-query e vence em 15 minutos com a aba aberta. Lido no interceptor,
 * toda requisição sai com o valor corrente.
 */
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const request = error.config as (InternalAxiosRequestConfig & { hasRetried?: boolean }) | undefined

    // Uma renovação e uma repetição. `hasRetried` é o que impede o laço quando o refresh também cai.
    if (error.response?.status === UNAUTHORIZED_STATUS && request && !request.hasRetried) {
      request.hasRetried = true
      const renewed = await refreshSession()
      if (renewed) return apiClient.request(request)
    }

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

/**
 * Espelha `addressInputSchema` do backend (sem latitude/longitude/geocodePrecision — esses só
 * nascem da geocodificação, nunca do cliente). Duplicado aqui porque frontend e api-quickcart são
 * apps separados; se um mudar de forma sem o outro, é a validação do servidor que apanha, não um
 * tipo compartilhado silenciosamente desatualizado.
 */
export type CreateOrderAddressInput = {
  cep: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  reference?: string
}

export type CreateOrderInput = {
  customer: { name: string; phone: string; email?: string }
  items: { productId: string; quantity: number }[]
  deliveryType: DeliveryType
  address?: CreateOrderAddressInput
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

export async function adminListCategories(): Promise<ApiCollectionResponse<Category>> {
  return apiClient.get('/v1/admin/categories', { })
}

export async function adminListProducts(params: ListAdminProductsParams = {}): Promise<ApiListResponse<Product>> {
  const { categoryId, ...rest } = params
  return apiClient.get('/v1/admin/products', {
    params: { ...rest, categoryId: categoryId && categoryId.length > 0 ? categoryId.join(',') : undefined },
  })
}

export async function adminCreateProduct(body: unknown): Promise<ApiItemResponse<Product>> {
  return apiClient.post('/v1/admin/products', body, { })
}

export async function adminUpdateProduct(id: string, body: unknown): Promise<ApiItemResponse<Product>> {
  return apiClient.put(`/v1/admin/products/${id}`, body, { })
}

export async function adminAdjustStock(id: string, body: { delta: number }): Promise<ApiItemResponse<Product>> {
  return apiClient.patch(`/v1/admin/products/${id}/stock`, body, { })
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

/** Lista vazia vira `undefined`: mandar `status=` sem valor faria o servidor filtrar por nada. */
function toCsvParam(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(',') : undefined
}

export async function adminListUnmatchedDemands(params: ListUnmatchedDemandsParams = {},
): Promise<UnmatchedDemandsResponse> {
  const { source, search, ...rest } = params
  return apiClient.get('/v1/admin/demands/unmatched', {
    params: {
      ...rest,
      source: toCsvParam(source),
      search: search && search.trim().length > 0 ? search.trim() : undefined,
    },
  })
}

export async function adminListOrders(params: ListAdminOrdersParams = {}): Promise<ApiListResponse<Order>> {
  const { status, deliveryType, paymentMethod, search, ...rest } = params
  return apiClient.get('/v1/admin/orders', {
    params: {
      ...rest,
      status: toCsvParam(status),
      deliveryType: toCsvParam(deliveryType),
      paymentMethod: toCsvParam(paymentMethod),
      search: search && search.trim().length > 0 ? search.trim() : undefined,
    },
  })
}

export async function adminGetOrderDetail(id: string): Promise<ApiItemResponse<OrderDetail>> {
  return apiClient.get(`/v1/admin/orders/${id}`, { })
}

export async function adminSetOrderItemUnavailable(params: { readonly orderId: string; readonly itemId: string; readonly unavailable: boolean },
): Promise<ApiItemResponse<OrderDetail>> {
  return apiClient.patch(
    `/v1/admin/orders/${params.orderId}/items/${params.itemId}/unavailable`,
    { unavailable: params.unavailable },
    { },
  )
}

/**
 * Marca item separado no servidor. Sem `itemId`, marca (ou limpa) todos de uma vez.
 *
 * A marcação era `localStorage`: separar no tablet do balcão e abrir no celular mostrava zero separado
 * num pedido que a esteira já dava como separado. Em lote numa requisição porque trinta itens seriam
 * trinta chances de metade ficar marcada se a rede cair no meio.
 */
export async function adminSetOrderItemPicked(params: { readonly orderId: string; readonly itemId?: string | undefined; readonly picked: boolean },
): Promise<ApiItemResponse<OrderDetail>> {
  const path = params.itemId
    ? `/v1/admin/orders/${params.orderId}/items/${params.itemId}/picked`
    : `/v1/admin/orders/${params.orderId}/items/picked`
  return apiClient.patch(path, { picked: params.picked }, { })
}

export type NotifyUnavailableItemsResponse = {
  readonly data: OrderDetail
  readonly meta: { readonly notifiedCount: number }
}

export async function adminNotifyUnavailableItems(orderId: string,
): Promise<NotifyUnavailableItemsResponse> {
  return apiClient.post(`/v1/admin/orders/${orderId}/unavailable-items/notify`, undefined, {
  })
}

export async function adminUpdateOrderStatus(id: string, status: string): Promise<ApiItemResponse<Order>> {
  return apiClient.patch(`/v1/admin/orders/${id}/status`, { status }, {
  })
}
