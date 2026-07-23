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
  SortDirection,
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

export async function adminListOrders(token: string, params: ListAdminOrdersParams = {}): Promise<ApiListResponse<Order>> {
  const { status, ...rest } = params
  return apiClient.get('/v1/admin/orders', {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...rest, status: status && status.length > 0 ? status.join(',') : undefined },
  })
}

export async function adminUpdateOrderStatus(token: string, id: string, status: string): Promise<ApiItemResponse<Order>> {
  return apiClient.patch(`/v1/admin/orders/${id}/status`, { status }, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
