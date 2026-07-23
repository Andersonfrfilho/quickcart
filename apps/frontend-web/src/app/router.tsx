import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type RouteConfig = {
  path: string
  component: () => React.ReactElement
}

type RouterContextValue = {
  navigate: (path: string) => void
  currentPath: string
  searchParams: URLSearchParams
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

    return (
      <RouterContext.Provider value={{ navigate, currentPath: location.pathname, searchParams }}>
        {children}
      </RouterContext.Provider>
    )
  }

  function RouteRenderer() {
    const { currentPath } = useRouter()
    const route = routes.find((r) => r.path === currentPath)
    if (route) return <route.component />
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
