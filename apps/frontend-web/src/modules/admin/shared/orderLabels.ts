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
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluir',
  cancelled: 'Cancelar pedido',
}

/** Ícone por transição. Mesmo símbolo dos cards de entrega e pagamento, para o painel falar uma língua só. */
export const ORDER_ACTION_ICONS: Record<string, string> = {
  confirmed: '✅',
  preparing: '▶️',
  separated: '📦',
  out_for_delivery: '🚚',
  ready_for_pickup: '🏪',
  completed: '🎉',
  cancelled: '❌',
}
