/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre os estados `cart_review` e `editing_cart` (spec §3.3/§4): resumo do
 * carrinho real com botões fechar/adicionar/editar, e edição item a item —
 * nova quantidade em texto livre, "0" remove — até "Concluir edição", que
 * volta a cart_review reenviando o resumo. "0" precisa de checagem própria
 * porque parseQuantityInput (compartilhado com BrowseHandler) rejeita
 * quantidade <= 0 de propósito, já que lá 0 não faz sentido.
 */

import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { RemoveCartItemUseCase } from '@/modules/cart/application/use-cases/RemoveCartItem.use-case'
import type { UpdateCartItemQuantityUseCase } from '@/modules/cart/application/use-cases/UpdateCartItemQuantity.use-case'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { buildEditingCartSection, type EditingCartRow } from '@/modules/conversation/application/handlers/support/InteractiveListBuilders'
import { parseQuantityInput } from '@/modules/conversation/application/handlers/support/parseQuantityInput'
import {
  describeRememberedCheckout,
  toRememberedCheckout,
  type RememberedCheckout,
} from '@/modules/conversation/application/rememberedCheckout'
import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import {
  CART_REVIEW_BUTTON_ID,
  DELIVERY_TYPE_BUTTONS,
  EDITING_CART_ROW_ID,
  EDITING_CART_ROW_PREFIX,
  MESSAGES,
  REMEMBERED_CHECKOUT_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'
import { CHANNEL } from '@/modules/shared/shared.constant'

const REMOVE_QUANTITY_TEXT = '0'

const cartLog = logger.child('CartHandler')

export type CartHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly removeCartItemUseCase: RemoveCartItemUseCase
  readonly updateCartItemQuantityUseCase: UpdateCartItemQuantityUseCase
  /**
   * Para reaproveitar as escolhas do último pedido no checkout.
   *
   * Opcionais: sem eles o checkout pergunta tudo, que é o comportamento de antes. Assim o handler não
   * passa a exigir dependência nova de quem só quer carrinho.
   */
  readonly orderRepository?: OrderRepositoryInterface | undefined
}

export class CartHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: CartHandlerDependencies) {}

  /**
   * `undefined` sempre que houver qualquer dúvida — e aí o checkout pergunta como sempre.
   *
   * Falha de leitura cai no caminho longo em vez de derrubar o fechamento: perder a compra por causa de
   * uma consulta de conveniência seria desproporcional.
   */
  private async resolveRememberedCheckout(customer: {
    readonly id: string
    readonly email?: string | null
  }): Promise<RememberedCheckout | undefined> {
    const { orderRepository } = this.dependencies
    if (!orderRepository) return undefined

    try {
      const lastOrder = await orderRepository.findLastByCustomer(customer.id)
      return toRememberedCheckout({ lastOrder, customerEmail: customer.email })
    } catch (error: unknown) {
      cartLog.warn('remembered_checkout_unavailable', { error: serializeError(error) })
      return undefined
    }
  }

  async handle(context: ConversationHandlerContext): Promise<void> {
    if (context.session.currentState === CONVERSATION_STATE.EDITING_CART) {
      await this.handleEditingCart(context)
      return
    }

    await this.handleCartReview(context)
  }

  private async handleCartReview({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    if (message.kind !== 'button_reply') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CART_REVIEW_UNEXPECTED_INPUT)
      return
    }

    if (message.buttonId === CART_REVIEW_BUTTON_ID.CHECKOUT) {
      const remembered = await this.resolveRememberedCheckout(customer)

      if (remembered) {
        // Uma pergunta em vez de quatro. O estado continua o mesmo: o handler de entrega reconhece os
        // dois botões novos, então o atalho não cria um estado a mais para manter.
        await this.dependencies.conversationSessionRepository.updateStateByPhone({
          customerPhone: session.customerPhone,
          currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE,
          context: { rememberedCheckout: remembered },
        })
        await this.dependencies.whatsAppSender.sendInteractiveButtons(
          session.customerPhone,
          MESSAGES.CHECKOUT_SAME_AS_LAST.replace('{resumo}', describeRememberedCheckout(remembered)),
          REMEMBERED_CHECKOUT_BUTTONS,
        )
        return
      }

      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendInteractiveButtons(
        session.customerPhone,
        MESSAGES.CHECKOUT_ASK_DELIVERY_TYPE,
        DELIVERY_TYPE_BUTTONS,
      )
      return
    }

    if (message.buttonId === CART_REVIEW_BUTTON_ID.ADD_MORE) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_LIST,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.AWAITING_LIST_PROMPT)
      return
    }

    if (message.buttonId === CART_REVIEW_BUTTON_ID.EDIT_CART) {
      await this.sendEditingCartList(session, customer.id)
      return
    }

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CART_REVIEW_UNEXPECTED_INPUT)
  }

  private async handleEditingCart({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const context = (session.context ?? {}) as ConversationContext

    if (context.editingCartItemId) {
      await this.handleEditingQuantityInput({ session, customerId: customer.id, cartItemId: context.editingCartItemId, message })
      return
    }

    if (message.kind !== 'list_reply') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_UNEXPECTED_INPUT)
      return
    }

    if (message.listId === EDITING_CART_ROW_ID.DONE) {
      await this.returnToCartReview(session, customer.id)
      return
    }

    if (message.listId.startsWith(EDITING_CART_ROW_PREFIX.ITEM)) {
      const cartItemId = message.listId.slice(EDITING_CART_ROW_PREFIX.ITEM.length)
      const cartItem = await this.dependencies.cartRepository.findItemById(cartItemId)
      if (!cartItem) {
        await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_UNEXPECTED_INPUT)
        return
      }

      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.EDITING_CART,
        context: { ...context, editingCartItemId: cartItemId },
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_ASK_QUANTITY)
      return
    }

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_UNEXPECTED_INPUT)
  }

  private async handleEditingQuantityInput(params: {
    session: ConversationSession
    customerId: string
    cartItemId: string
    message: ConversationHandlerContext['message']
  }): Promise<void> {
    const { session, customerId, cartItemId, message } = params

    if (message.kind !== 'text') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_QUANTITY_INVALID)
      return
    }

    const trimmedBody = message.body.trim()

    if (trimmedBody === REMOVE_QUANTITY_TEXT) {
      await this.dependencies.removeCartItemUseCase.execute({ cartItemId })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_ITEM_REMOVED)
      await this.sendEditingCartList(session, customerId)
      return
    }

    const parsedQuantity = parseQuantityInput(trimmedBody)
    if (!parsedQuantity) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_QUANTITY_INVALID)
      return
    }

    await this.dependencies.updateCartItemQuantityUseCase.execute({ cartItemId, quantity: parsedQuantity.quantity })
    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.EDITING_CART_ITEM_UPDATED)
    await this.sendEditingCartList(session, customerId)
  }

  private async sendEditingCartList(session: ConversationSession, customerId: string): Promise<void> {
    const cart = await this.dependencies.cartRepository.findOpenByCustomer(customerId, CHANNEL.WHATSAPP)
    if (!cart) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.CART_REVIEW,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CART_EMPTY)
      return
    }

    const rows = await this.buildEditingRows(cart.id)

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.EDITING_CART,
      context: {},
    })

    const section = buildEditingCartSection(rows)
    await this.dependencies.whatsAppSender.sendInteractiveList(session.customerPhone, MESSAGES.EDITING_CART_PICK_ITEM, 'Editar item', [
      section,
    ])
  }

  private async buildEditingRows(cartId: string): Promise<EditingCartRow[]> {
    const items = await this.dependencies.cartRepository.listItems(cartId)
    const products = await Promise.all(items.map((item) => this.dependencies.productRepository.findById(item.productId)))

    return items.map((item, index) => ({
      cartItemId: item.id,
      productName: products[index]?.name ?? item.productId,
      quantity: item.quantity,
      priceInCents: products[index]?.priceInCents ?? 0,
    }))
  }

  private async returnToCartReview(session: ConversationSession, customerId: string): Promise<void> {
    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.CART_REVIEW,
      context: {},
    })

    const cart = await this.dependencies.cartRepository.findOpenByCustomer(customerId, CHANNEL.WHATSAPP)
    if (!cart) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CART_EMPTY)
      return
    }

    await sendCartSummary({
      customerPhone: session.customerPhone,
      cartId: cart.id,
      cartRepository: this.dependencies.cartRepository,
      productRepository: this.dependencies.productRepository,
      whatsAppSender: this.dependencies.whatsAppSender,
    })
  }
}
