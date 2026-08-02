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
import { AdminDemandsPage } from '@/modules/admin/pages/AdminDemands.page'
import { AdminOrderDetailPage } from '@/modules/admin/pages/AdminOrderDetail.page'
import { OrderDetailPreviewPage } from '@/modules/preview/pages/OrderDetailPreview.page'
import { AdminConversationsPage } from '@/modules/conversations/pages/AdminConversations.page'
import { AdminDocumentsPage } from '@/modules/conversations/pages/AdminDocuments.page'
import { AdminMessagesPage } from '@/modules/messages/pages/AdminMessages.page'
import { AdminFlowsPage } from '@/modules/flows/pages/AdminFlows.page'
import { CustomerPreviewPage } from '@/modules/preview/pages/CustomerPreview.page'
import { AgentPreviewPage } from '@/modules/preview/pages/AgentPreview.page'
import { IS_PREVIEW_ENABLED } from '@/modules/preview/shared/previewEnvironment'

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

// Rotas só de desenvolvimento. `IS_PREVIEW_ENABLED` é constante em build time, então em produção
// o array nem contém as entradas e o bundler descarta as páginas — o preview carrega o app secret
// de dev, e a garantia precisa ser de build, não de runtime.
const previewRoutes = IS_PREVIEW_ENABLED
  ? [
      { path: '/preview/customer', component: standalone(CustomerPreviewPage) },
      { path: '/preview/agent', component: standalone(AgentPreviewPage) },
      // Tela de pedido com dado de mentira: é onde o desenho é ajustado, com lista longa e sem sessão.
      { path: '/preview/order', component: standalone(OrderDetailPreviewPage) },
    ]
  : []

export const { RouterProvider, RouteRenderer } = createRouter([
  { path: '/', component: withStoreLayout(HomePage) },
  { path: '/category', component: withStoreLayout(CategoryPage) },
  { path: '/cart', component: withStoreLayout(CartPage) },
  { path: '/checkout', component: withStoreLayout(CheckoutPage) },
  { path: '/order-confirmed', component: withStoreLayout(OrderConfirmedPage) },
  { path: '/admin', component: standalone(AdminLoginPage) },
  { path: '/admin/products', component: withAdminLayout(AdminProductsPage) },
  { path: '/admin/orders', component: withAdminLayout(AdminOrdersPage) },
  // Depois da rota fixa: exata vence parametrizada, e deixar as duas juntas mostra a hierarquia.
  { path: '/admin/orders/:id', component: withAdminLayout(AdminOrderDetailPage) },
  { path: '/admin/demands', component: withAdminLayout(AdminDemandsPage) },
  { path: '/admin/conversations', component: withAdminLayout(AdminConversationsPage) },
  { path: '/admin/documents', component: withAdminLayout(AdminDocumentsPage) },
  { path: '/admin/messages', component: withAdminLayout(AdminMessagesPage) },
  { path: '/admin/flows', component: withAdminLayout(AdminFlowsPage) },
  ...previewRoutes,
])
