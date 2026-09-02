import React, { useState } from 'react'
import { useRouter, Link } from '@/app/router'
import { TYPOGRAPHY } from '@/shared/theme'
import { useCartStore } from '@/modules/store/shared/cartStore'
import { Badge, Button } from '@/components/ui'
import { usePendingOrdersAlert } from '@/modules/admin/hooks/usePendingOrdersAlert.hook'
import { NotificationBell } from '@adatechnology/notification-ui'
import { useUnreadCount } from '@adatechnology/notification-ui/headless'
import { useUser, useUserApi } from '@adatechnology/user-ui'
import {
  ADMIN_AND_ATTENDANT,
  ADMIN_ONLY,
  ROLE_LABEL,
  STAFF_ROLES,
} from '@/modules/auth/shared/roles.constant'
import type { QuickCartRole } from '@/modules/auth/shared/roles.constant'

type NavItem = {
  label: string
  path: string
  icon: string
  /**
   * Caminho que mostra contagem ao vivo ao lado do rótulo.
   *
   * Marcado no item, e não no componente que desenha: quem lê a lista descobre ali que Pedidos tem
   * sinal, sem precisar caçar um `if` no meio do JSX.
   */
  showsPendingOrders?: boolean
  /** Mesma mecânica: o número vem do notification-ui e fica visível de qualquer tela. */
  showsUnreadNotifications?: boolean
  /**
   * Quem enxerga o item. Os mesmos conjuntos que a guarda da rota usa.
   *
   * Sem isto o separador via "Produtos" e era devolvido ao login ao clicar — link que existe só
   * para recusar é pior que link ausente. Isto é NAVEGAÇÃO, não segurança: quem decide é a api,
   * que valida o papel em toda requisição.
   */
  roles: readonly QuickCartRole[]
}

/** A loja não tem papéis: ela é para quem está comprando, logado ou não. */
type StoreNavItem = Omit<NavItem, 'roles'>

type NavSection = {
  label: string
  items: NavItem[]
}

// Agrupado pelo trabalho de quem usa (operar a loja × atender cliente), não por qual pacote
// implementa a tela — quem atende não sabe nem precisa saber que Conversas vem do conversations-ui.
// Cabeçalho estático em vez de menu colapsável: com cinco destinos, um accordion cobraria um clique
// e esconderia caminho sem economizar espaço.
const ADMIN_SECTIONS: NavSection[] = [
  {
    label: 'Loja',
    items: [
      { label: 'Produtos', path: '/admin/products', icon: '📦', roles: ADMIN_ONLY },
      { label: 'Pedidos', path: '/admin/orders', icon: '🛒', showsPendingOrders: true, roles: STAFF_ROLES },
      { label: 'Demanda', path: '/admin/demands', icon: '🔎', roles: ADMIN_AND_ATTENDANT },
      {
        label: 'Notificações',
        path: '/admin/notifications',
        icon: '🔔',
        showsUnreadNotifications: true,
        roles: STAFF_ROLES,
      },
    ],
  },
  {
    label: 'Atendimento',
    items: [
      { label: 'Conversas', path: '/admin/conversations', icon: '💬', roles: ADMIN_AND_ATTENDANT },
      { label: 'Documentos', path: '/admin/documents', icon: '📎', roles: ADMIN_AND_ATTENDANT },
      { label: 'Mensagens', path: '/admin/messages', icon: '✉️', roles: ADMIN_AND_ATTENDANT },
      { label: 'Fluxo do bot', path: '/admin/flows', icon: '🔀', roles: ADMIN_ONLY },
      { label: 'Templates', path: '/admin/templates', icon: '📄', roles: ADMIN_ONLY },
    ],
  },
  {
    label: 'Administração',
    items: [{ label: 'Equipe', path: '/admin/equipe', icon: '👥', roles: ADMIN_ONLY }],
  },
]

/** Seção sem nenhum item visível não vira cabeçalho órfão. */
function visibleSections(role: QuickCartRole | undefined): NavSection[] {
  if (!role) return []

  return ADMIN_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)
}

const STORE_NAV: StoreNavItem[] = [
  { label: 'Loja', path: '/', icon: '🏪' },
  { label: 'Carrinho', path: '/cart', icon: '🛒' },
]

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentPath, navigate } = useRouter()
  const { user } = useUser()
  const { signOut } = useUserApi()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pendingCount } = usePendingOrdersAlert()
  // Do pacote: o hook headless cuida de cache e do stream, e a sidebar só desenha o número.
  const { data: unreadCount = 0 } = useUnreadCount()

  const isActive = (path: string) => currentPath.startsWith(path)

  async function handleSignOut() {
    await signOut()
    navigate('/entrar')
  }

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

          <nav className="flex-1 overflow-y-auto p-4 space-y-5">
            {visibleSections(user?.role as QuickCartRole | undefined).map((section) => (
              <div key={section.label} className="space-y-1">
                <p className="px-3 pb-1 font-semibold uppercase tracking-wide text-muted-foreground" style={{ fontSize: TYPOGRAPHY.size.xs }}>
                  {section.label}
                </p>
                {section.items.map((item) => (
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
                    {/* Pedido esperando é trabalho parado: o número fica no menu, visível de qualquer
                        tela do painel, e não só na de Pedidos. */}
                    {item.showsPendingOrders && pendingCount > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {pendingCount}
                      </Badge>
                    )}
                    {item.showsUnreadNotifications && unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </button>
                ))}

              </div>
            ))}
          </nav>

          {/*
            Sair existe porque a sessão agora SOBREVIVE ao fechar da aba: o refresh mora num cookie
            de 30 dias. Com o token antigo em sessionStorage, fechar a aba já era o logout — agora,
            sem este botão, o tablet do balcão fica logado para quem pegar depois.
          */}
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ fontSize: TYPOGRAPHY.size.sm }}>{user?.name}</p>
                <p className="truncate text-muted-foreground" style={{ fontSize: TYPOGRAPHY.size.xs }}>
                  {user ? ROLE_LABEL[user.role as QuickCartRole] ?? user.role : ''}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span className="ml-2">Sair</span>
              </Button>
            </div>
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

          {/*
            O sino fica só no header do celular porque no desktop não existe header — o painel
            sinaliza pela sidebar, e é lá que a contagem aparece. Duplicar aqui e lá no monitor daria
            dois lugares com o mesmo número disputando o olhar.
          */}
          <NotificationBell className="ml-auto" onClick={() => navigate('/admin/notifications')} />
        </header>

        {/* Sem padding no celular: 24px em cada lado tiram 13% da largura de uma tela de 375px, e
            nas telas de altura cheia (conversas, fluxo) o padding vertical ainda somava 48px à
            altura já calculada em 100vh, criando um segundo scroll por fora do painel. Quem precisa
            de respiro no celular é a página, que sabe se é conteúdo de leitura ou superfície cheia. */}
        {/* Sem padding em nenhum tamanho: quem sabe se precisa de respiro é a página. Telas de
            superfície cheia (conversas) trazem o próprio, e o do layout virava moldura dupla — uma
            borda em volta de tudo, visível como um quadro em torno do painel. */}
        <main className="flex-1 overflow-auto p-0">
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
