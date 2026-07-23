import React from 'react'
import { createRouter } from '@/app/router'
import { AdminLayout, StoreLayout } from '@/components/Layout'
import { HomePage } from '@/modules/store/pages/Home.page'
import { CategoryPage } from '@/modules/store/pages/Category.page'
import { CartPage } from '@/modules/store/pages/Cart.page'
import { CheckoutPage } from '@/modules/store/pages/Checkout.page'
import { OrderConfirmedPage } from '@/modules/store/pages/OrderConfirmed.page'
import { AdminLoginPage } from '@/modules/admin/pages/AdminLogin.page'
import { AdminProductsPage } from '@/modules/admin/pages/AdminProducts.page'
import { AdminOrdersPage } from '@/modules/admin/pages/AdminOrders.page'

function withAdminLayout(Component: () => React.ReactElement | null) {
  return function Wrapped() {
    return (
      <AdminLayout>
        <Component />
      </AdminLayout>
    )
  }
}

function withStoreLayout(Component: () => React.ReactElement) {
  return function Wrapped() {
    return (
      <StoreLayout>
        <Component />
      </StoreLayout>
    )
  }
}

function standalone(Component: () => React.ReactElement) {
  return Component
}

export const { RouterProvider, RouteRenderer } = createRouter([
  { path: '/', component: withStoreLayout(HomePage) },
  { path: '/category', component: withStoreLayout(CategoryPage) },
  { path: '/cart', component: withStoreLayout(CartPage) },
  { path: '/checkout', component: withStoreLayout(CheckoutPage) },
  { path: '/order-confirmed', component: withStoreLayout(OrderConfirmedPage) },
  { path: '/admin', component: standalone(AdminLoginPage) },
  { path: '/admin/products', component: withAdminLayout(AdminProductsPage) },
  { path: '/admin/orders', component: withAdminLayout(AdminOrdersPage) },
])
