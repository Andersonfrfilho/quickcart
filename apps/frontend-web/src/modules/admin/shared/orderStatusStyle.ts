import { ORDER_STATUS } from '@/shared/api/api.types'

/**
 * Rótulo de cada situação, em um lugar só.
 *
 * Estava duplicado na lista e no detalhe, com textos DIFERENTES para o mesmo estado ("Aguardando" numa
 * tela, "Aguardando confirmação" na outra). Duas verdades sobre o mesmo pedido é como o operador aprende a
 * não confiar em nenhuma.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  [ORDER_STATUS.PENDING_CONFIRMATION]: 'Aguardando confirmação',
  [ORDER_STATUS.CONFIRMED]: 'Confirmado',
  [ORDER_STATUS.PREPARING]: 'Separando',
  [ORDER_STATUS.SEPARATED]: 'Separado',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'Pronto para retirada',
  [ORDER_STATUS.COMPLETED]: 'Concluído',
  [ORDER_STATUS.CANCELLED]: 'Cancelado',
}

/**
 * Uma cor por situação.
 *
 * O `Badge` tem quatro variantes para oito estados, então "separando", "saiu para entrega" e "pronto para
 * retirada" apareciam idênticos — e é justamente entre esses três que o operador precisa distinguir de
 * relance numa lista de quinze pedidos.
 *
 * As cores seguem a ordem da esteira: âmbar espera, azul aceito, violeta separando, ciano separado, laranja
 * na rua, teal no balcão, verde fim, vermelho cancelado — a cor carrega progresso, não só identidade.
 *
 * E há um segundo eixo, o preenchimento: os dois estados que COBRAM alguém (na rua, esperando retirada)
 * são sólidos. Matiz sozinho não separou oito estados num badge pequeno — âmbar e laranja pareciam iguais,
 * ciano, teal e verde também.
 *
 * A cor nunca é o único sinal: o rótulo está sempre escrito ao lado, porque quem não distingue matiz
 * também precisa operar a loja.
 *
 * Cada entrada declara claro e escuro. Sem o par escuro, o badge vira bloco saturado sobre fundo preto e o
 * texto perde contraste — o tema escuro é o padrão de quem trabalha à noite no balcão.
 */
const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  // Espera: claro, para não competir com o que exige ação.
  [ORDER_STATUS.PENDING_CONFIRMATION]:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  [ORDER_STATUS.CONFIRMED]: 'border-transparent bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200',
  [ORDER_STATUS.PREPARING]:
    'border-transparent bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200',
  [ORDER_STATUS.SEPARATED]: 'border-transparent bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-200',

  /*
   * Em movimento ou esperando alguém aparecer: SÓLIDO.
   *
   * Só matiz não bastou. Lado a lado, âmbar e laranja pareciam a mesma etiqueta, e ciano, teal e verde
   * também — matizes vizinhos brigam quando o badge é pequeno. O preenchimento é um segundo eixo que
   * separa os pares mesmo para quem enxerga cor de forma diferente, e cai bem no significado: estes dois
   * estados são os que cobram alguém.
   */
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'border-transparent bg-orange-600 text-white dark:bg-orange-500 dark:text-white',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'border-transparent bg-teal-700 text-white dark:bg-teal-500 dark:text-white',

  // Fim de linha: verde apagado, porque pedido concluído não precisa disputar atenção na lista.
  [ORDER_STATUS.COMPLETED]:
    'border-transparent bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  // Cancelado mantém borda: some do fluxo, mas não deve virar linha invisível numa auditoria.
  [ORDER_STATUS.CANCELLED]: 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300',
}

/**
 * Classe do badge para uma situação. Status desconhecido cai no cinza neutro em vez de sumir.
 *
 * Status novo no servidor e front antigo é o caso de deploy escalonado — e um badge invisível esconderia
 * justamente o pedido que ninguém sabe interpretar.
 */
export function orderStatusBadgeClass(status: string): string {
  return ORDER_STATUS_BADGE_CLASSES[status] ?? 'border-transparent bg-muted text-muted-foreground'
}

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status
}
