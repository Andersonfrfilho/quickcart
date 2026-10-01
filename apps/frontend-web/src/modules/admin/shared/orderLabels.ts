import { ORDER_STATUS } from '@/shared/api/api.types'
import { orderStatusLabel } from '@/modules/admin/shared/orderStatusStyle'

/**
 * Rótulos de entrega e pagamento, em um lugar só.
 *
 * Eram constantes locais da página de pedidos, e a tabela saiu de lá para virar componente próprio —
 * duplicá-las era como "🚚 Entrega" e "Entrega" começariam a aparecer no mesmo painel para o mesmo dado.
 * Os filtros e as células da tabela leem daqui.
 */
export const DELIVERY_LABELS: Record<string, string> = { delivery: '🚚 Entrega', pickup: '🏪 Retirada' }

export const PAYMENT_LABELS: Record<string, string> = {
  pix: '💳 Pix',
  card_on_delivery: '💳 Cartão na entrega',
  cash: '💵 Dinheiro',
}

/**
 * O que o botão FAZ, não o estado que ele representa.
 *
 * "Confirmado" e "Cancelado" lado a lado são nomes de situação — lidos juntos, pareciam dizer que o
 * pedido já estava confirmado e cancelado ao mesmo tempo. Botão é verbo.
 *
 * Mora aqui, e não na tela do pedido, porque a tabela desenhava os mesmos botões com o nome do ESTADO:
 * a mesma ação tinha dois nomes em duas telas do mesmo painel, e é assim que o operador aprende a não
 * confiar em nenhuma das duas.
 */
export const ORDER_ACTION_LABELS: Record<string, string> = {
  confirmed: 'Confirmar pedido',
  preparing: 'Iniciar separação',
  separated: 'Marcar como separado',
  out_for_delivery: 'Saiu da loja',
  in_transit: 'A caminho do cliente',
  arrived_at_customer: 'Cheguei na porta',
  ready_for_pickup: 'Pronto para retirada',
  delivery_failed: 'Registrar ocorrência',
  completed: 'Concluir',
  cancelled: 'Cancelar pedido',
}

/**
 * O mesmo destino diz coisas diferentes conforme de ONDE o pedido sai.
 *
 * Voltar da espera pelo cliente cai em `preparing`, e "Iniciar separação" ali seria mentira: a separação já
 * começou, ficou parada esperando resposta sobre item em falta. Quem lê "iniciar" num pedido cuja sacola já
 * está meio cheia desconfia de ter perdido o trabalho feito.
 */
const ORDER_ACTION_LABELS_BY_ORIGIN: Record<string, Record<string, string>> = {
  [ORDER_STATUS.AWAITING_CUSTOMER_DECISION]: {
    [ORDER_STATUS.PREPARING]: 'Retomar separação',
  },
  // "Concluir" sozinho não diz qual das duas coisas aconteceu — e são fatos diferentes no balcão.
  [ORDER_STATUS.OUT_FOR_DELIVERY]: { [ORDER_STATUS.COMPLETED]: 'Confirmar entrega' },
  [ORDER_STATUS.IN_TRANSIT]: { [ORDER_STATUS.COMPLETED]: 'Confirmar entrega' },
  [ORDER_STATUS.ARRIVED_AT_CUSTOMER]: { [ORDER_STATUS.COMPLETED]: 'Confirmar entrega' },
  [ORDER_STATUS.READY_FOR_PICKUP]: { [ORDER_STATUS.COMPLETED]: 'Confirmar retirada' },
  // Sair para entrega DEPOIS de uma ocorrência é outra viagem, não a primeira.
  [ORDER_STATUS.DELIVERY_FAILED]: { [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Tentar entregar de novo' },
}

export function orderActionLabel(params: { readonly next: string; readonly from: string }): string {
  return (
    ORDER_ACTION_LABELS_BY_ORIGIN[params.from]?.[params.next] ??
    ORDER_ACTION_LABELS[params.next] ??
    orderStatusLabel(params.next)
  )
}

/** Ícone por transição. Mesmo símbolo dos cards de entrega e pagamento, para o painel falar uma língua só. */
export const ORDER_ACTION_ICONS: Record<string, string> = {
  confirmed: '✅',
  preparing: '▶️',
  separated: '📦',
  out_for_delivery: '🚚',
  in_transit: '🛵',
  arrived_at_customer: '🔔',
  ready_for_pickup: '🏪',
  delivery_failed: '⚠️',
  completed: '🎉',
  cancelled: '❌',
}
