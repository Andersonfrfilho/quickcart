import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type RouteConfig = {
  path: string
  component: () => React.ReactElement
}

type RouterContextValue = {
  navigate: (path: string) => void
  currentPath: string
  searchParams: URLSearchParams
  /**
   * Segmentos nomeados da rota casada (`/admin/orders/:id` → `{ id: '…' }`).
   *
   * Vazio quando a rota não tem parâmetro. Fica no contexto, e não numa prop da página, para a página
   * não depender de quem a renderizou passar o id certo.
   */
  params: Readonly<Record<string, string>>
}

const RouterContext = createContext<RouterContextValue | null>(null)

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within RouterProvider')
  return ctx
}

type Location = { pathname: string; search: string }

// currentPath só deve conter o path — o router antigo comparava o hash inteiro
// (incluindo query string) contra `route.path`, então qualquer navegação com
// `?query` caía direto no 404.
function parseHash(hash: string): Location {
  const raw = hash.slice(1) || '/'
  const [pathname = '/', search = ''] = raw.split('?')
  return { pathname, search }
}

/**
 * Casa `/admin/orders/:id` com `/admin/orders/abc`.
 *
 * O roteador comparava path por igualdade, então rota com parâmetro simplesmente caía no 404 — e a
 * saída fácil seria empurrar o id para a query string, deixando a URL mentir sobre a hierarquia da
 * tela. Segmento a segmento, sem regex: o casamento é literal exceto onde começa com `:`, e um path
 * com número de segmentos diferente nem chega a ser comparado.
 */
function matchRoute(routePath: string, currentPath: string): Readonly<Record<string, string>> | undefined {
  if (routePath === currentPath) return {}
  if (!routePath.includes(':')) return undefined

  const routeSegments = routePath.split('/')
  const currentSegments = currentPath.split('/')
  if (routeSegments.length !== currentSegments.length) return undefined

  const params: Record<string, string> = {}

  for (const [index, routeSegment] of routeSegments.entries()) {
    const currentSegment = currentSegments[index] ?? ''
    if (routeSegment.startsWith(':')) {
      // Segmento vazio não é valor: `/admin/orders/` não deve casar com `/admin/orders/:id`.
      if (currentSegment.length === 0) return undefined
      params[routeSegment.slice(1)] = decodeURIComponent(currentSegment)
      continue
    }
    if (routeSegment !== currentSegment) return undefined
  }

  return params
}

export function createRouter(routes: RouteConfig[]) {
  function RouterProvider({ children }: { children: ReactNode }) {
    const [location, setLocation] = useState<Location>(() => parseHash(window.location.hash))

    useEffect(() => {
      const onHashChange = () => setLocation(parseHash(window.location.hash))
      window.addEventListener('hashchange', onHashChange)
      return () => window.removeEventListener('hashchange', onHashChange)
    }, [])

    const navigate = useCallback((path: string) => {
      window.location.hash = path
    }, [])

    const searchParams = new URLSearchParams(location.search)

    /**
     * Rota exata antes de rota com parâmetro.
     *
     * Sem essa ordem, `/admin/orders/:id` engoliria uma futura `/admin/orders/novo` — e o bug
     * apareceria como "a tela de novo pedido abre em branco", que não parece problema de rota.
     */
    const matched = routes
      .map((route) => ({ route, params: matchRoute(route.path, location.pathname) }))
      .filter((entry): entry is { route: RouteConfig; params: Readonly<Record<string, string>> } => !!entry.params)
      .sort((left, right) => Object.keys(left.params).length - Object.keys(right.params).length)[0]

    return (
      <RouterContext.Provider
        value={{ navigate, currentPath: location.pathname, searchParams, params: matched?.params ?? {} }}
      >
        {children}
      </RouterContext.Provider>
    )
  }

  function RouteRenderer() {
    const { currentPath } = useRouter()
    const matched = routes
      .map((route) => ({ route, params: matchRoute(route.path, currentPath) }))
      .filter((entry): entry is { route: RouteConfig; params: Readonly<Record<string, string>> } => !!entry.params)
      .sort((left, right) => Object.keys(left.params).length - Object.keys(right.params).length)[0]
    if (matched) return <matched.route.component />
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-4">404</h1>
        <p className="text-gray-600">Página não encontrada</p>
      </div>
    )
  }

  return { RouterProvider, RouteRenderer, routes }
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const { navigate } = useRouter()
  return (
    <button type="button" onClick={() => navigate(to)} className={className}>
      {children}
    </button>
  )
}
