/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O pedido aberto para quem vai separar e entregar.
 *
 * Separado de `GetOrderByShortCode`, que é do CLIENTE e exige o telefone do solicitante para provar
 * que o pedido é dele. Aqui quem pergunta é a loja, autenticada por token de admin, e precisa de coisa
 * que o cliente não pede: telefone para ligar, endereço para entregar, itens para conferir.
 *
 * Busca por id, não por código curto: a lista já tem o id em mãos, e o código curto é o que o cliente
 * digita — usar o mesmo identificador nos dois lados só criaria chance de vazar pedido por adivinhação.
 */

import { OrderNotFoundError } from '@/shared/errors/OrderErrors'
import type { OrderDetail, OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'

type GetAdminOrderDetailUseCaseDependencies = {
  readonly orderRepository: OrderRepositoryInterface
}

export class GetAdminOrderDetailUseCase {
  constructor(private readonly dependencies: GetAdminOrderDetailUseCaseDependencies) {}

  async execute(params: { readonly orderId: string }): Promise<OrderDetail> {
    const detail = await this.dependencies.orderRepository.findDetailById(params.orderId)
    if (!detail) throw new OrderNotFoundError(params.orderId)
    return detail
  }
}
