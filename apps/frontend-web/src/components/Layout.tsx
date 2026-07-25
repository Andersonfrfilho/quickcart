import React, { useState } from 'react'
import { useRouter, Link } from '@/app/router'
import { TYPOGRAPHY } from '@/shared/theme'
import { useCartStore } from '@/modules/store/shared/cartStore'
import { Badge } from '@/components/ui'

type NavItem = {
  label: string
  path: string
  icon: string
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Produtos', path: '/admin/products', icon: '📦' },
  { label: 'Pedidos', path: '/admin/orders', icon: '🛒' },
]

const STORE_NAV: NavItem[] = [
  { label: 'Loja', path: '/', icon: '🏪' },
  { label: 'Carrinho', path: '/cart', icon: '🛒' },
]

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentPath, navigate } = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (path: string) => currentPath.startsWith(path)

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                QC
              </div>
              <div>
                <h1 className="font-semibold" style={{ fontSize: TYPOGRAPHY.size.lg }}>QuickCart</h1>
                <p className="text-muted-foreground" style={{ fontSize: TYPOGRAPHY.size.xs }}>Painel Admin</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {ADMIN_NAV.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: TYPOGRAPHY.size.xs }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>Ada Technology</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-accent"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 font-medium">QuickCart Admin</span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export function StoreLayout({ children }: { children: React.ReactNode }) {
  const { currentPath, navigate } = useRouter()
  const cartItemCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0))

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              QC
            </div>
            <span className="font-semibold text-lg">QuickCart</span>
          </button>

          <nav className="flex items-center gap-1">
            {STORE_NAV.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  currentPath === item.path
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
              >
                <span className="relative">
                  {item.icon}
                  {item.path === '/cart' && cartItemCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
                    >
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </Badge>
                  )}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
