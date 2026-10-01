/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Mantém a tela de um pedido acordada.
 *
 * Duas camadas, e a segunda não é redundância: o push é o caminho normal, e o refetch é o que cobre a
 * janela em que ele não existe — 4G que cai no corredor do mercado, proxy que mata conexão ociosa,
 * tablet que dormiu. Sem a segunda, a tela fica parada acreditando num stream que morreu em silêncio.
 */

import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { connectOrderStream, ORDER_CHANGED_EVENT } from '@/modules/admin/shared/ordersSse'

export function useOrderRealtime(orderId: string): { readonly isRealtimeConnected: boolean } {
  const queryClient = useQueryClient()
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(false)

  React.useEffect(() => {
    if (orderId.length === 0) return

    const source = connectOrderStream({ orderId, onConnectionChange: setIsRealtimeConnected })

    /*
     * O evento só diz que mudou. Invalidar em vez de escrever o cache com o payload é o que mantém
     * uma única serialização de pedido: a rota de detalhe é quem sabe montar transições permitidas,
     * estimativa de entrega e valor devido — reconstruir isso aqui criaria a segunda versão da verdade.
     */
    const handleOrderChanged = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['admin-order-detail', orderId] })
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
    }

    source.addEventListener(ORDER_CHANGED_EVENT, handleOrderChanged)

    return () => {
      source.removeEventListener(ORDER_CHANGED_EVENT, handleOrderChanged)
      source.close()
    }
  }, [orderId, queryClient])

  return { isRealtimeConnected }
}
