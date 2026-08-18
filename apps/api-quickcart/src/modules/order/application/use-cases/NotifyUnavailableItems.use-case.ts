/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Avisa o cliente das faltas do pedido, em UMA mensagem, quando a loja decidir avisar.
 *
 * Antes, marcar um item como em falta mandava a mensagem no mesmo instante. Quem separa uma compra de mês
 * marca três ou quatro itens andando pelo corredor, e o cliente recebia uma mensagem por item — cada uma
 * anunciando um total diferente, todas fora de ordem em relação ao que ainda ia ser descoberto. E a loja
 * não tinha como reler o recado antes de ele sair.
 *
 * Agora marcar é registro interno; avisar é ação explícita de quem separa, com tudo junto e o total final.
 *
 * Idempotente por construção: só entram os itens em falta AINDA não avisados. Dois cliques no botão não
 * mandam dois recados, e um item marcado depois do primeiro aviso entra no segundo.
 *
 * Dois caminhos, escolhidos pela loja no clique: PERGUNTAR (o pedido para até o cliente responder) ou
 * INFORMAR (o recado sai como aviso e a separação segue). Quem conhece o cliente e o item que faltou é
 * quem está com a sacola na mão — falta de sacola plástica não merece parar uma entrega, e falta do
 * remédio da criança não deve seguir sem consulta.
 */

import { OrderCustomerApprovalRequiredError, OrderNotFoundError } from '@/shared/errors/OrderErrors'
import type { OrderDetail, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import {
  buildUnavailableNoticeBody,
  hasAnythingLeftToDeliver,
  type NotifyCustomer,
} from '@/modules/order/shared/customerDecisionMessage'
import type { AskUnavailableItemsUseCase } from './AskUnavailableItems.use-case'
import { ORDER_STATUS } from '@/modules/order/shared/Order.constant'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'

const useCaseLog = logger.child('NotifyUnavailableItems')

/**
 * De onde se pode entrar no desvio: a falta só aparece com alguém de fato mexendo na sacola.
 *
 * O próprio desvio está na lista porque a segunda falta acontece — quem já perguntou uma vez encontra outro
 * item vazio na prateleira e avisa de novo. Sem ele, a pergunta sairia e o relógio da cobrança continuaria
 * marcando a partir da primeira, que é uma pergunta que o cliente nem viu por último.
 */
const ASKABLE_FROM_STATUSES = [
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.SEPARATED,
  ORDER_STATUS.AWAITING_CUSTOMER_DECISION,
] as const

type NotifyUnavailableItemsDependencies = {
  readonly orderRepository: OrderRepositoryInterface
  /**
   * Quem decide QUAL pergunta sai e a manda com botões.
   *
   * Um use case e não um `sendText`: sem botão a resposta vem em texto livre ("pode mandar o resto"), e aí
   * alguém precisa ler e clicar por ele — que é o trabalho que a pergunta automática existe para poupar. E
   * a escolha entre perguntar a troca de um item ou o pedido inteiro é a mesma que a resposta do cliente
   * refaz depois, então mora fora daqui (ADR 0003).
   */
  readonly askUnavailableItemsUseCase: AskUnavailableItemsUseCase
  /**
   * O aviso sem pergunta, para quando a loja já decidiu seguir. Texto puro, sem botão.
   *
   * Dependência separada e não uma flag no `askCustomer`: são canais com formatos diferentes na Graph API,
   * e um `sendInteractiveButtons` com lista vazia de botões é mensagem recusada.
   */
  readonly notifyCustomer: NotifyCustomer
  /**
   * A cobrança única, N horas depois. Recebe só o id — fila carrega referência, não dado pessoal.
   *
   * Fica como dependência porque BullMQ não tem por que existir dentro de uma regra de negócio: o use case
   * diz "cobre mais tarde", e quem monta o container decide se isso é uma fila, um cron ou nada.
   */
  readonly scheduleDecisionReminder: (params: { readonly orderId: string }) => Promise<void>
}

export type NotifyUnavailableItemsResult = {
  readonly detail: OrderDetail
  /** Quantos itens entraram no recado. Zero significa que não havia nada novo a avisar. */
  readonly notifiedCount: number
}

export class NotifyUnavailableItemsUseCase {
  constructor(private readonly dependencies: NotifyUnavailableItemsDependencies) {}

  async execute(params: {
    readonly orderId: string
    /**
     * Esperar o cliente decidir, ou só informar e seguir.
     *
     * A escolha é da loja e muda tudo depois daqui: com aprovação o pedido para no desvio e a separação só
     * continua com a resposta; sem aprovação o recado sai como informação e quem está com a sacola fecha a
     * etapa na hora. Não há padrão — deixar implícito faria a loja descobrir qual dos dois pelo efeito.
     */
    readonly requiresCustomerApproval: boolean
  }): Promise<NotifyUnavailableItemsResult> {
    const detail = await this.dependencies.orderRepository.findDetailById(params.orderId)
    if (!detail) throw new OrderNotFoundError(params.orderId)

    const pending = detail.items.filter(
      (item) => item.unavailableAt !== null && item.unavailableNotifiedAt === null,
    )
    if (pending.length === 0) return { detail, notifiedCount: 0 }

    if (!params.requiresCustomerApproval && !hasAnythingLeftToDeliver(detail)) {
      throw new OrderCustomerApprovalRequiredError(params.orderId)
    }

    /**
     * Manda primeiro, marca depois.
     *
     * Se marcasse antes e o envio falhasse, o pedido ficaria com "cliente avisado" sobre um recado que
     * ninguém recebeu — e ninguém descobriria. Na ordem inversa, o pior caso é a marca falhar depois de o
     * cliente já ter sido avisado: a tela continua oferecendo avisar, alguém clica de novo e ele recebe
     * duas mensagens. Mensagem repetida incomoda; cliente sem aviso perde a compra.
     */
    if (params.requiresCustomerApproval) {
      /*
       * Qual pergunta sai — a troca de um item ou a do pedido inteiro — é decisão de um lugar só, porque a
       * resposta do cliente reentra pelo mesmo caminho para perguntar o item seguinte (ADR 0003). Ela também
       * carimba os itens que entraram no recado, então o carimbo em lote abaixo não vale para este ramo.
       */
      await this.dependencies.askUnavailableItemsUseCase.execute({ detail })
    } else {
      await this.dependencies.notifyCustomer({
        whatsappNumber: detail.order.customerPhone,
        body: buildUnavailableNoticeBody({ detail, unavailableItems: pending }),
      })

      try {
        await this.dependencies.orderRepository.markUnavailableItemsNotified(params.orderId)
      } catch (error: unknown) {
        useCaseLog.error('notification_not_stamped', { orderId: params.orderId, error: serializeError(error) })
      }
    }

    /*
     * Sem aprovação, o pedido não sai do lugar: a separação continua de onde estava e a loja fecha a etapa
     * quando terminar. Nada de desvio, nada de cobrança horas depois — não há resposta a esperar.
     */
    if (!params.requiresCustomerApproval) {
      const informed = await this.dependencies.orderRepository.findDetailById(params.orderId)
      return { detail: informed ?? detail, notifiedCount: pending.length }
    }

    /**
     * Só agora o pedido entra no desvio: a pergunta já saiu, então "aguardando o cliente" é verdade.
     *
     * `undefined` aqui é o pedido que saiu de `preparing`/`separated` entre a leitura e esta escrita — a
     * loja cancelou, por exemplo. Nesse caso o recado já foi (não dá para desmandar), mas forçar o status
     * atropelaria a decisão de quem estava com a sacola na mão. Fica logado e a tela mostra o estado real.
     */
    const moved = await this.dependencies.orderRepository.startCustomerDecision({
      orderId: params.orderId,
      allowedCurrentStatuses: ASKABLE_FROM_STATUSES,
    })

    if (moved) {
      await this.dependencies.scheduleDecisionReminder({ orderId: params.orderId })
    } else {
      useCaseLog.warn('customer_decision_not_started', { orderId: params.orderId, status: detail.order.status })
    }

    const updated = await this.dependencies.orderRepository.findDetailById(params.orderId)
    return { detail: updated ?? detail, notifiedCount: pending.length }
  }
}
