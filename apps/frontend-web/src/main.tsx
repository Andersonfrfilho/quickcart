import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationProvider } from '@adatechnology/notification-ui'
import { UserProvider } from '@adatechnology/user-ui'
import { RouterProvider, RouteRenderer } from '@/app/routes'
import { notificationClient } from '@/modules/notifications/shared/notificationClient'
import { quickCartUserApi } from '@/modules/auth/shared/quickCartUserApi'
import './index.css'
import '@adatechnology/notification-ui/styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        Dentro do QueryClientProvider porque os hooks do pacote usam o mesmo cache do painel — uma
        instância só, então invalidar em um lugar reflete no outro.

        Envolve o app inteiro, e não apenas o admin, porque o sino aparece no header do painel e a
        página de notificações é uma rota como outra qualquer. Sem token, as chamadas respondem 401 e
        os componentes ficam vazios — que é o comportamento correto na loja, onde não há sino.
      */}
      <UserProvider api={quickCartUserApi}>
        <NotificationProvider client={notificationClient}>
          <RouterProvider>
            <RouteRenderer />
          </RouterProvider>
        </NotificationProvider>
      </UserProvider>
    </QueryClientProvider>
  </StrictMode>,
)
