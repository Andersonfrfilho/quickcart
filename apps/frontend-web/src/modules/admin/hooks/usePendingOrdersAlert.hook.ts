import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminToken } from '@/modules/admin/shared/useAdminAuth.hook'
import { adminListOrders } from '@/shared/api/client'
import { ORDER_STATUS } from '@/shared/api/api.types'

/**
 * De quanto em quanto tempo a contagem é relida do servidor.
 *
 * Vinte segundos porque o pedido chega pelo WhatsApp e alguém precisa começar a separar: mais que isso
 * o cliente já está esperando sem ninguém saber. Não é SSE de propósito — o stream existente é por
 * ticket e vive dentro da tela de conversas, e abrir uma segunda conexão em todo o painel para carregar
 * um número seria mais peça para manter do que o problema pede. Se a espera passar a incomodar, aí o
 * evento no stream vale o encanamento.
 */
const REFETCH_INTERVAL_MS = 20_000

/** Só o total importa: `perPage: 1` transfere uma linha e o servidor devolve a contagem inteira. */
const COUNT_ONLY_PER_PAGE = 1

/**
 * Dois tons curtos, gerados na hora.
 *
 * Sem arquivo de áudio para não somar asset ao bundle por causa de um bipe. Falha em silêncio de
 * propósito: navegador bloqueia som antes de qualquer interação do usuário, e nesse caso o número no
 * menu já cumpre o aviso — som é reforço, não o sinal.
 */
function playNewOrderChime(): void {
  try {
    const AudioContextConstructor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    const audioContext = new AudioContextConstructor()
    const startAt = audioContext.currentTime

    for (const [index, frequency] of [880, 1174].entries()) {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, startAt + index * 0.16)
      // Rampa curta em vez de ligar/desligar seco: corte abrupto estala no alto-falante.
      gain.gain.exponentialRampToValueAtTime(0.2, startAt + index * 0.16 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + index * 0.16 + 0.15)

      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(startAt + index * 0.16)
      oscillator.stop(startAt + index * 0.16 + 0.16)
    }

    // Fecha o contexto depois do bipe: um contexto por aviso, aberto para sempre, vaza.
    window.setTimeout(() => void audioContext.close(), 600)
  } catch {
    // Sem som. O número continua na tela.
  }
}

/**
 * Quantos pedidos estão esperando a loja, com aviso quando entra um novo.
 *
 * A contagem vem do servidor a cada leitura, e não de um contador incrementado na tela: recarregar a
 * página, abrir em outra aba ou atender pelo celular não podem zerar o que ainda não foi preparado.
 */
export function usePendingOrdersAlert() {
  const token = getAdminToken()

  const { data } = useQuery({
    queryKey: ['admin-pending-orders-count'],
    queryFn: () =>
      adminListOrders(token as string, {
        status: [ORDER_STATUS.PENDING_CONFIRMATION],
        page: 1,
        perPage: COUNT_ONLY_PER_PAGE,
      }),
    enabled: !!token,
    refetchInterval: REFETCH_INTERVAL_MS,
    // Voltar para a aba é exatamente quando o lojista quer o número certo.
    refetchOnWindowFocus: true,
  })

  const pendingCount = data?.pagination.total ?? 0

  /**
   * `undefined` até a primeira leitura, para não tocar o bipe ao abrir o painel.
   *
   * Sem isso, cada carregamento de página com pedido na fila soaria como pedido novo — e um aviso que
   * mente deixa de ser ouvido em poucos dias.
   */
  const lastSeenCountRef = React.useRef<number | undefined>(undefined)

  React.useEffect(() => {
    if (!data) return

    const previous = lastSeenCountRef.current
    lastSeenCountRef.current = pendingCount

    if (previous !== undefined && pendingCount > previous) playNewOrderChime()
  }, [data, pendingCount])

  return { pendingCount }
}
