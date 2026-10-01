/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mantém a LISTA do balcão acordada.
 *
 * A tela fica aberta o dia inteiro num tablet que ninguém toca, e o que ela precisa mostrar na hora é o
 * pedido que acabou de entrar — não vale nada aparecer vinte segundos depois de o cliente já ter mandado
 * a segunda mensagem perguntando se chegou.
 */

import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { connectOrdersStream, ORDER_CHANGED_EVENT } from '@/modules/admin/shared/ordersSse'

export function useOrdersRealtime(): { readonly isRealtimeConnected: boolean } {
  const queryClient = useQueryClient()
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(false)

  React.useEffect(() => {
    const source = connectOrdersStream({ onConnectionChange: setIsRealtimeConnected })

    /*
     * Invalida a lista inteira, sem olhar o id do payload: o filtro e a página são da tela, e decidir
     * aqui se aquele pedido cabe na consulta atual seria reimplementar o `where` do servidor no cliente
     * — que é como a lista passaria a esconder pedido que deveria mostrar.
     *
     * O contador de pendentes vai junto porque é a mesma notícia contada de outro jeito.
     */
    const handleOrderChanged = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-orders-count'] })
    }

    source.addEventListener(ORDER_CHANGED_EVENT, handleOrderChanged)

    return () => {
      source.removeEventListener(ORDER_CHANGED_EVENT, handleOrderChanged)
      source.close()
    }
  }, [queryClient])

  return { isRealtimeConnected }
}
