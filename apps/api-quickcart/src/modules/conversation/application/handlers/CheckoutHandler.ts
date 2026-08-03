/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Cobre delivery→address→payment→receipt→email→confirming (spec §3.3/§4). Ids de
 * botão (DELIVERY_TYPE_BUTTON_ID etc.) reaproveitam exatamente os valores de domínio
 * de Order.constant.ts, então nenhum mapeamento é necessário ao persistir o pedido.
 * `retirada` pula o endereço; `whatsapp` como preferência de recibo pula o e-mail —
 * ambos convergem em `enterConfirming`. Erros de domínio do use case (carrinho vazio,
 * estoque insuficiente) são traduzidos aqui porque um handler de WhatsApp não tem o
 * exception filter HTTP do Router como rede de segurança (code-standart.md §7).
 */

import type { Customer } from '@/infra/database/schema'
import type { ConversationSession } from '@/modules/webhook/domain/Conversation.types'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import type { CreateOrderFromCartUseCase } from '@/modules/order/application/use-cases/CreateOrderFromCart.use-case'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import {
  CONFIRMING_BUTTON_ID,
  CONFIRMING_BUTTONS,
  REMEMBERED_CHECKOUT_BUTTON_ID,
  DELIVERY_TYPE_BUTTON_ID,
  DELIVERY_TYPE_BUTTONS,
  MESSAGES,
  PAYMENT_METHOD_BUTTON_ID,
  PAYMENT_METHOD_BUTTONS,
  RECEIPT_PREFERENCE_BUTTON_ID,
  RECEIPT_PREFERENCE_BUTTONS,
} from '@/modules/conversation/shared/Messages.constant'
import type { AddressLookupProviderInterface } from '@/modules/shared/address/AddressLookupProvider.interface'
import { formatAddressLine } from '@/modules/shared/address/formatAddressLine'
import { parseAddressNumberReply } from '@/modules/shared/address/parseAddressNumberReply'
import { CHANNEL } from '@/modules/shared/shared.constant'
import { OrderEmptyCartError, OrderInsufficientStockError } from '@/shared/errors/OrderErrors'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type InteractiveButtonOption = { readonly id: string; readonly title: string }

export type CheckoutHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
  readonly createOrderFromCartUseCase: CreateOrderFromCartUseCase
  readonly addressLookupProvider: AddressLookupProviderInterface
}

/**
 * Tira a memória do contexto depois de usada (ou recusada).
 *
 * Com `exactOptionalPropertyTypes`, atribuir `undefined` não é o mesmo que não ter a chave — e deixar a
 * memória para trás faria a pergunta "mantenho igual?" reaparecer no meio do caminho longo.
 */
function withoutRememberedCheckout(context: ConversationContext): ConversationContext {
  const next = { ...context }
  delete (next as { rememberedCheckout?: unknown }).rememberedCheckout
  return next
}

export class CheckoutHandler implements ConversationHandlerInterface {
  constructor(private readonly dependencies: CheckoutHandlerDependencies) {}

  async handle(context: ConversationHandlerContext): Promise<void> {
    switch (context.session.currentState) {
      case CONVERSATION_STATE.AWAITING_DELIVERY_TYPE:
        await this.handleAwaitingDeliveryType(context)
        return
      case CONVERSATION_STATE.AWAITING_ADDRESS:
        await this.handleAwaitingAddress(context)
        return
      case CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER:
        await this.handleAwaitingAddressNumber(context)
        return
      case CONVERSATION_STATE.AWAITING_PAYMENT:
        await this.handleAwaitingPayment(context)
        return
      case CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE:
        await this.handleAwaitingReceiptPreference(context)
        return
      case CONVERSATION_STATE.AWAITING_EMAIL:
        await this.handleAwaitingEmail(context)
        return
      default:
        await this.handleConfirming(context)
    }
  }

  private async handleAwaitingDeliveryType({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'button_reply') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_UNEXPECTED_INPUT)
      return
    }

    const remembered = checkoutContext.rememberedCheckout

    /**
     * "Isso mesmo": aplica em bloco o que o cliente ACABOU de ler e vai direto à confirmação final.
     *
     * Os valores vêm do contexto, não de uma nova leitura do banco: entre a pergunta e a resposta ele
     * viu um resumo, e aplicar algo diferente do que estava na tela trairia a confirmação. Ele ainda
     * passa pela tela de confirmar/cancelar — este atalho corta as perguntas, não a última palavra.
     */
    if (remembered && message.buttonId === REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST) {
      await this.enterConfirming(session, customer.id, {
        ...withoutRememberedCheckout(checkoutContext),
        checkoutDeliveryType: remembered.deliveryType,
        ...(remembered.address !== undefined ? { checkoutAddress: remembered.address } : {}),
        checkoutPaymentMethod: remembered.paymentMethod,
        checkoutReceiptPreference: remembered.receiptPreference,
        ...(remembered.email ? { checkoutEmail: remembered.email } : {}),
      })
      return
    }

    // "Quero mudar": volta ao caminho longo, e esquece a memória para não reoferecer no meio dele.
    if (remembered && message.buttonId === REMEMBERED_CHECKOUT_BUTTON_ID.CHANGE_PREFERENCES) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_DELIVERY_TYPE,
        context: withoutRememberedCheckout(checkoutContext),
      })
      await this.dependencies.whatsAppSender.sendInteractiveButtons(
        session.customerPhone,
        MESSAGES.CHECKOUT_ASK_DELIVERY_TYPE,
        DELIVERY_TYPE_BUTTONS,
      )
      return
    }

    if (message.buttonId === DELIVERY_TYPE_BUTTON_ID.DELIVERY) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_ADDRESS,
        context: { ...checkoutContext, checkoutDeliveryType: message.buttonId },
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_ADDRESS)
      return
    }

    if (message.buttonId === DELIVERY_TYPE_BUTTON_ID.PICKUP) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_PAYMENT,
        context: { ...checkoutContext, checkoutDeliveryType: message.buttonId },
      })
      await this.dependencies.whatsAppSender.sendInteractiveButtons(
        session.customerPhone,
        MESSAGES.CHECKOUT_ASK_PAYMENT,
        PAYMENT_METHOD_BUTTONS,
      )
      return
    }

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_UNEXPECTED_INPUT)
  }

  /**
   * CEP primeiro (spec §8 Q1): 8 dígitos que resolvem no ViaCEP avançam para o passo estruturado
   * (só falta número/complemento). Qualquer outra coisa — CEP que não resolve, ou o cliente já
   * mandando o endereço inteiro, apesar da pergunta — vira o endereço final em texto livre, como
   * sempre foi. CEP que não resolve NÃO trava: pede o endereço completo e segue.
   */
  private async handleAwaitingAddress({ session, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'text' || message.body.trim().length === 0) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_ADDRESS)
      return
    }

    const digitsOnly = message.body.replace(/\D/g, '')
    if (digitsOnly.length === 8) {
      const found = await this.dependencies.addressLookupProvider.lookupByCep(digitsOnly)
      if (found) {
        await this.dependencies.conversationSessionRepository.updateStateByPhone({
          customerPhone: session.customerPhone,
          currentState: CONVERSATION_STATE.AWAITING_ADDRESS_NUMBER,
          context: { ...checkoutContext, checkoutAddressDraft: { cep: digitsOnly, ...found } },
        })
        await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_ADDRESS_NUMBER)
        return
      }

      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_ADDRESS_FALLBACK)
      return
    }

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_PAYMENT,
      context: { ...checkoutContext, checkoutAddress: message.body.trim() },
    })
    await this.dependencies.whatsAppSender.sendInteractiveButtons(
      session.customerPhone,
      MESSAGES.CHECKOUT_ASK_PAYMENT,
      PAYMENT_METHOD_BUTTONS,
    )
  }

  /**
   * "412, apto 71" → número e complemento. Regra estrutural única (o que vem antes da primeira
   * vírgula é o número), não interpretação de texto livre — o endereço nasce estruturado porque
   * cada campo tem seu próprio passo, este é só o último.
   */
  private async handleAwaitingAddressNumber({ session, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext
    const draft = checkoutContext.checkoutAddressDraft

    if (message.kind !== 'text' || message.body.trim().length === 0 || !draft) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_ADDRESS_NUMBER)
      return
    }

    const { number, complement } = parseAddressNumberReply(message.body)

    // O rascunho não sobrevive a este passo — mantê-lo ao lado do endereço final seria dois valores
    // competindo pela mesma pergunta ("qual endereço vale, o rascunho ou o final?").
    const contextWithoutDraft = { ...checkoutContext }
    delete (contextWithoutDraft as { checkoutAddressDraft?: unknown }).checkoutAddressDraft

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_PAYMENT,
      context: {
        ...contextWithoutDraft,
        checkoutAddress: {
          cep: draft.cep,
          street: draft.street,
          number,
          ...(complement ? { complement } : {}),
          neighborhood: draft.neighborhood,
          city: draft.city,
          state: draft.state,
        },
      },
    })
    await this.dependencies.whatsAppSender.sendInteractiveButtons(
      session.customerPhone,
      MESSAGES.CHECKOUT_ASK_PAYMENT,
      PAYMENT_METHOD_BUTTONS,
    )
  }

  private async handleAwaitingPayment({ session, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'button_reply' || !this.isKnownButtonId(PAYMENT_METHOD_BUTTON_ID, message.buttonId)) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_UNEXPECTED_INPUT)
      return
    }

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE,
      context: { ...checkoutContext, checkoutPaymentMethod: message.buttonId },
    })
    await this.dependencies.whatsAppSender.sendInteractiveButtons(
      session.customerPhone,
      MESSAGES.CHECKOUT_ASK_RECEIPT_PREFERENCE,
      RECEIPT_PREFERENCE_BUTTONS,
    )
  }

  private async handleAwaitingReceiptPreference({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'button_reply' || !this.isKnownButtonId(RECEIPT_PREFERENCE_BUTTON_ID, message.buttonId)) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_UNEXPECTED_INPUT)
      return
    }

    const nextContext: ConversationContext = { ...checkoutContext, checkoutReceiptPreference: message.buttonId }

    if (message.buttonId === RECEIPT_PREFERENCE_BUTTON_ID.WHATSAPP) {
      await this.enterConfirming(session, customer.id, nextContext)
      return
    }

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_EMAIL,
      context: nextContext,
    })
    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_EMAIL)
  }

  private async handleAwaitingEmail({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'text') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_UNEXPECTED_INPUT)
      return
    }

    const email = message.body.trim()
    if (!EMAIL_PATTERN.test(email)) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_EMAIL_INVALID)
      return
    }

    await this.dependencies.customerRepository.updateContactInfo({ customerId: customer.id, email })
    await this.enterConfirming(session, customer.id, { ...checkoutContext, checkoutEmail: email })
  }

  private async handleConfirming({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'button_reply') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CONFIRMING_UNEXPECTED_INPUT)
      return
    }

    if (message.buttonId === CONFIRMING_BUTTON_ID.CANCEL) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.GREETING,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.ORDER_CANCELLED)
      return
    }

    if (message.buttonId === CONFIRMING_BUTTON_ID.CONFIRM) {
      await this.confirmOrder(session, customer, checkoutContext)
      return
    }

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CONFIRMING_UNEXPECTED_INPUT)
  }

  private async confirmOrder(session: ConversationSession, customer: Customer, checkoutContext: ConversationContext): Promise<void> {
    const { checkoutDeliveryType, checkoutPaymentMethod, checkoutReceiptPreference } = checkoutContext

    if (!checkoutDeliveryType || !checkoutPaymentMethod || !checkoutReceiptPreference) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.MAIN_MENU,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.FALLBACK_STATE_NOT_READY)
      return
    }

    const cart = await this.dependencies.cartRepository.findOpenByCustomer(customer.id, CHANNEL.WHATSAPP)
    if (!cart) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.GREETING,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.ORDER_CART_EMPTY_ERROR)
      return
    }

    try {
      const { order } = await this.dependencies.createOrderFromCartUseCase.execute({
        cartId: cart.id,
        customerId: customer.id,
        channel: CHANNEL.WHATSAPP,
        deliveryType: checkoutDeliveryType,
        address: checkoutContext.checkoutAddress,
        paymentMethod: checkoutPaymentMethod,
        receiptPreference: checkoutReceiptPreference,
      })

      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.GREETING,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, `${MESSAGES.ORDER_CONFIRMED_PREFIX} ${order.shortCode}`)
    } catch (error) {
      await this.handleConfirmOrderError(session, cart.id, error)
    }
  }

  private async handleConfirmOrderError(session: ConversationSession, cartId: string, error: unknown): Promise<void> {
    if (error instanceof OrderEmptyCartError) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.GREETING,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.ORDER_CART_EMPTY_ERROR)
      return
    }

    if (error instanceof OrderInsufficientStockError) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.CART_REVIEW,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.ORDER_INSUFFICIENT_STOCK)
      await sendCartSummary({
        customerPhone: session.customerPhone,
        cartId,
        cartRepository: this.dependencies.cartRepository,
        productRepository: this.dependencies.productRepository,
        whatsAppSender: this.dependencies.whatsAppSender,
      })
      return
    }

    throw error
  }

  private async enterConfirming(session: ConversationSession, customerId: string, checkoutContext: ConversationContext): Promise<void> {
    const cart = await this.dependencies.cartRepository.findOpenByCustomer(customerId, CHANNEL.WHATSAPP)
    if (!cart) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.GREETING,
        context: {},
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.ORDER_CART_EMPTY_ERROR)
      return
    }

    const summaryText = await this.buildConfirmingSummary(cart.id, checkoutContext)

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.CONFIRMING,
      context: checkoutContext,
    })
    await this.dependencies.whatsAppSender.sendInteractiveButtons(session.customerPhone, summaryText, CONFIRMING_BUTTONS)
  }

  private async buildConfirmingSummary(cartId: string, checkoutContext: ConversationContext): Promise<string> {
    const cartItems = await this.dependencies.cartRepository.listItems(cartId)
    const products = await Promise.all(cartItems.map((item) => this.dependencies.productRepository.findById(item.productId)))

    let totalInCents = 0
    const lines = cartItems.map((item, index) => {
      const product = products[index]
      const lineTotalInCents = Math.round((product?.priceInCents ?? 0) * item.quantity)
      totalInCents += lineTotalInCents
      return `• ${item.quantity}x ${product?.name ?? item.productId} — ${formatPriceInCents(lineTotalInCents)}`
    })

    const deliveryLine = this.describeSelection(DELIVERY_TYPE_BUTTONS, checkoutContext.checkoutDeliveryType)
    /*
     * `String(objeto)` virava "[object Object]" desde que o endereço passou a nascer estruturado
     * (T2.2) — `formatAddressLine` entende os dois formatos, o novo e o texto livre de quem já
     * estava no meio do checkout antes do deploy.
     */
    const formattedAddress = formatAddressLine(checkoutContext.checkoutAddress)
    const addressLine = formattedAddress ? `📍 ${formattedAddress}` : undefined
    const paymentLine = this.describeSelection(PAYMENT_METHOD_BUTTONS, checkoutContext.checkoutPaymentMethod)
    const receiptLine = this.describeSelection(RECEIPT_PREFERENCE_BUTTONS, checkoutContext.checkoutReceiptPreference)

    return [
      MESSAGES.CONFIRMING_SUMMARY_HEADER,
      ...lines,
      '',
      `${MESSAGES.CART_SUMMARY_TOTAL_PREFIX} ${formatPriceInCents(totalInCents)}`,
      '',
      deliveryLine,
      ...(addressLine ? [addressLine] : []),
      paymentLine,
      receiptLine,
      '',
      MESSAGES.CONFIRMING_ASK,
    ]
      .filter((line) => line !== undefined)
      .join('\n')
  }

  private describeSelection(buttons: ReadonlyArray<InteractiveButtonOption>, id: string | undefined): string {
    return buttons.find((button) => button.id === id)?.title ?? ''
  }

  private isKnownButtonId(buttonIdMap: Record<string, string>, buttonId: string): boolean {
    return Object.values(buttonIdMap).includes(buttonId)
  }
}
