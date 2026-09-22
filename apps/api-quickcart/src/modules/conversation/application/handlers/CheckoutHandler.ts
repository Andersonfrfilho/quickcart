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
import type { OrderRecord } from '@/modules/order/domain/OrderRepository.interface'
import type { CreateOrderFromCartUseCase } from '@/modules/order/application/use-cases/CreateOrderFromCart.use-case'
import type { ResolveOrderDeliveryEstimateUseCase } from '@/modules/order/application/use-cases/ResolveOrderDeliveryEstimate.use-case'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import type { ConversationHandlerContext, ConversationHandlerInterface } from '@/modules/conversation/application/handlers/ConversationHandler.interface'
import type { ConversationContext } from '@/modules/conversation/shared/ConversationContext.types'
import { sendCartSummary } from '@/modules/conversation/application/handlers/support/CartSummary'
import { enterConfirming } from '@/modules/conversation/application/handlers/support/enterConfirming'
import { calculateCartTotalInCents } from '@/modules/conversation/application/handlers/support/cartTotal'
import { resolveCheckoutDeliveryFeeInCents } from '@/modules/conversation/shared/resolveCheckoutDeliveryFeeInCents'
import type { AskCashChangeAgainParams } from '@/modules/conversation/application/types/CheckoutHandler.types'
import { requiresCardMachine } from '@/modules/order/shared/requiresCardMachine'
import { amountDueInCents, resolveDeliveryFeeInCents } from '@/modules/order/shared/amountDue'
import { DELIVERY_TYPE } from '@/modules/order/shared/Order.constant'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import { formatPriceInCents } from '@/modules/conversation/shared/formatPriceInCents'
import { logger } from '@/shared/logger'
import { serializeError } from '@/shared/serializeError'
import {
  CASH_CHANGE_BUTTONS,
  CONFIRMING_BUTTON_ID,
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
import { parseAddressNumberReply } from '@/modules/shared/address/parseAddressNumberReply'
import { CHANNEL } from '@/modules/shared/shared.constant'
import { OrderEmptyCartError, OrderInsufficientStockError } from '@/shared/errors/OrderErrors'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const checkoutLog = logger.child('CheckoutHandler')

export type CheckoutHandlerDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
  readonly createOrderFromCartUseCase: CreateOrderFromCartUseCase
  readonly resolveOrderDeliveryEstimateUseCase: ResolveOrderDeliveryEstimateUseCase
  readonly addressLookupProvider: AddressLookupProviderInterface
  readonly storePreparationMinutes: number
  /** `DELIVERY_FEE_CENTS`. Lida só ao escolher a entrega; dali em diante vale a cotada no contexto. */
  readonly configuredDeliveryFeeInCents: number
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

  private quoteDeliveryFeeInCents(deliveryType: string): number {
    return resolveDeliveryFeeInCents({ deliveryType, configuredFeeInCents: this.dependencies.configuredDeliveryFeeInCents })
  }

  private async handleAwaitingDeliveryType({ session, customer, message }: ConversationHandlerContext): Promise<void> {
    const checkoutContext = (session.context ?? {}) as ConversationContext

    if (message.kind !== 'button_reply') {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_UNEXPECTED_INPUT)
      return
    }

    const remembered = checkoutContext.rememberedCheckout

    /**
     * "Isso mesmo": aplica em bloco o que o cliente ACABOU de ler e vai direto à confirmação final —
     * EXCETO o troco (correção T1.1/T1.2): o troco depende do total DESTA compra, não da anterior,
     * então dinheiro lembrado ainda precisa perguntar de novo, com tudo o mais já preenchido no
     * contexto. Cartão na entrega lembrado passa pelo mesmo aviso da maquininha que o caminho longo.
     *
     * Os valores vêm do contexto, não de uma nova leitura do banco: entre a pergunta e a resposta ele
     * viu um resumo, e aplicar algo diferente do que estava na tela trairia a confirmação. Ele ainda
     * passa pela tela de confirmar/cancelar — este atalho corta as perguntas, não a última palavra.
     */
    if (remembered && message.buttonId === REMEMBERED_CHECKOUT_BUTTON_ID.SAME_AS_LAST) {
      const rememberedContext: ConversationContext = {
        ...withoutRememberedCheckout(checkoutContext),
        checkoutDeliveryType: remembered.deliveryType,
        checkoutDeliveryFeeInCents: this.quoteDeliveryFeeInCents(remembered.deliveryType),
        ...(remembered.address !== undefined ? { checkoutAddress: remembered.address } : {}),
        checkoutPaymentMethod: remembered.paymentMethod,
        checkoutReceiptPreference: remembered.receiptPreference,
        ...(remembered.email ? { checkoutEmail: remembered.email } : {}),
      }

      if (remembered.paymentMethod === PAYMENT_METHOD_BUTTON_ID.CASH) {
        await this.dependencies.conversationSessionRepository.updateStateByPhone({
          customerPhone: session.customerPhone,
          currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE,
          context: rememberedContext,
        })
        await this.dependencies.whatsAppSender.sendInteractiveButtons(
          session.customerPhone,
          MESSAGES.CHECKOUT_ASK_CASH_CHANGE,
          CASH_CHANGE_BUTTONS,
        )
        return
      }

      if (requiresCardMachine({ paymentMethod: remembered.paymentMethod, deliveryType: remembered.deliveryType })) {
        await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_CARD_ON_DELIVERY_MACHINE_NOTICE)
      }

      await enterConfirming({
        dependencies: this.dependencies,
        customerPhone: session.customerPhone,
        customerId: customer.id,
        checkoutContext: rememberedContext,
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
        context: {
          ...checkoutContext,
          checkoutDeliveryType: message.buttonId,
          checkoutDeliveryFeeInCents: this.quoteDeliveryFeeInCents(message.buttonId),
        },
      })
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_ASK_ADDRESS)
      return
    }

    if (message.buttonId === DELIVERY_TYPE_BUTTON_ID.PICKUP) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_PAYMENT,
        context: {
          ...checkoutContext,
          checkoutDeliveryType: message.buttonId,
          checkoutDeliveryFeeInCents: this.quoteDeliveryFeeInCents(message.buttonId),
        },
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

    const nextContext = { ...checkoutContext, checkoutPaymentMethod: message.buttonId }

    /*
     * Só dinheiro pergunta troco (roteiro §9). Os outros meios seguem direto para o recibo, como
     * antes — o `CashChangeHandler` (arquivo próprio, spec/tasks.md T1.1) cuida do resto e devolve
     * o cliente para `AWAITING_RECEIPT_PREFERENCE` sozinho.
     */
    if (message.buttonId === PAYMENT_METHOD_BUTTON_ID.CASH) {
      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE,
        context: nextContext,
      })
      await this.dependencies.whatsAppSender.sendInteractiveButtons(
        session.customerPhone,
        MESSAGES.CHECKOUT_ASK_CASH_CHANGE,
        CASH_CHANGE_BUTTONS,
      )
      return
    }

    /*
     * A maquininha só existe na entrega: quem retira na loja paga no caixa, sem entregador (spec
     * §3.2). É a MESMA função do selo no painel — o pedido ainda não existe aqui, mas os ids dos
     * botões já são os valores de domínio (`confirmOrder` os grava direto), então não há tradução
     * nem uma segunda cópia da regra, que é como as duas acabariam divergindo.
     */
    if (requiresCardMachine({ paymentMethod: message.buttonId, deliveryType: checkoutContext.checkoutDeliveryType ?? '' })) {
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CHECKOUT_CARD_ON_DELIVERY_MACHINE_NOTICE)
    }

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE,
      context: nextContext,
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
      await enterConfirming({ dependencies: this.dependencies, customerPhone: session.customerPhone, customerId: customer.id, checkoutContext: nextContext })
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
    await enterConfirming({
      dependencies: this.dependencies,
      customerPhone: session.customerPhone,
      customerId: customer.id,
      checkoutContext: { ...checkoutContext, checkoutEmail: email },
    })
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

    if (message.buttonId === CONFIRMING_BUTTON_ID.EDIT) {
      await this.alterCheckout(session, customer, checkoutContext)
      return
    }

    await this.dependencies.whatsAppSender.sendText(session.customerPhone, MESSAGES.CONFIRMING_UNEXPECTED_INPUT)
  }

  /**
   * "Alterar" (T2.3, spec §3.4): volta ao carrinho sem descartar nada. O carrinho persistido não é
   * tocado — só o estado da conversa muda — e a exibição reaproveita `sendCartSummary`, a mesma
   * função que `CartHandler` usa para entrar em `cart_review`.
   *
   * O contexto de checkout já escolhido nesta sessão vira `rememberedCheckout` (mesmo formato do
   * atalho lembrado de pedido anterior), para o "Isso mesmo" oferecer de novo entrega e pagamento
   * ao fechar o pedido de novo — sem isso o `rememberedCheckout` só nasceria do ÚLTIMO PEDIDO
   * confirmado no banco, que não existe ainda neste ponto (o cliente está alterando ANTES de
   * confirmar). Ele passa pelo MESMO caminho do atalho lembrado
   * (`handleAwaitingDeliveryType`), então troco é reperguntado e a taxa de entrega é recotada do
   * contexto atual, nunca copiados direto do que já tinha sido escolhido (correção T1.1/T1.2).
   */
  private async alterCheckout(session: ConversationSession, customer: Customer, checkoutContext: ConversationContext): Promise<void> {
    const { checkoutDeliveryType, checkoutAddress, checkoutPaymentMethod, checkoutReceiptPreference, checkoutEmail } = checkoutContext

    const rememberedCheckout: ConversationContext['rememberedCheckout'] =
      checkoutDeliveryType && checkoutPaymentMethod && checkoutReceiptPreference
        ? {
            deliveryType: checkoutDeliveryType,
            ...(checkoutAddress !== undefined ? { address: checkoutAddress } : {}),
            paymentMethod: checkoutPaymentMethod,
            receiptPreference: checkoutReceiptPreference,
            ...(checkoutEmail ? { email: checkoutEmail } : {}),
          }
        : undefined

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.CART_REVIEW,
      context: rememberedCheckout ? { rememberedCheckout } : {},
    })

    const cart = await this.dependencies.cartRepository.findOpenByCustomer(customer.id, CHANNEL.WHATSAPP)
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

    const deliveryFeeInCents = resolveCheckoutDeliveryFeeInCents({
      context: checkoutContext,
      configuredFeeInCents: this.dependencies.configuredDeliveryFeeInCents,
    })
    if (await this.askCashChangeAgainIfTotalChanged({ session, cartId: cart.id, checkoutContext, deliveryFeeInCents })) return

    try {
      const { order } = await this.dependencies.createOrderFromCartUseCase.execute({
        cartId: cart.id,
        customerId: customer.id,
        channel: CHANNEL.WHATSAPP,
        deliveryType: checkoutDeliveryType,
        address: checkoutContext.checkoutAddress,
        paymentMethod: checkoutPaymentMethod,
        receiptPreference: checkoutReceiptPreference,
        cashChangeForInCents: checkoutContext.checkoutCashChangeForInCents,
        quotedDeliveryFeeInCents: deliveryFeeInCents,
      })

      await this.dependencies.conversationSessionRepository.updateStateByPhone({
        customerPhone: session.customerPhone,
        currentState: CONVERSATION_STATE.GREETING,
        context: {},
      })
      const deliveryEstimateLine = await this.buildDeliveryEstimateLine(order)

      const confirmationLines = [
        `${MESSAGES.ORDER_CONFIRMED_PREFIX} ${order.shortCode}`,
        MESSAGES.ORDER_CONFIRMED_TOTAL_LINE.replace('{total}', formatPriceInCents(amountDueInCents(order))),
        ...(order.cashChangeForInCents !== null
          ? [MESSAGES.ORDER_CONFIRMED_CASH_CHANGE_LINE.replace('{valor}', formatPriceInCents(order.cashChangeForInCents))]
          : []),
        ...(deliveryEstimateLine ? [deliveryEstimateLine] : []),
      ]
      await this.dependencies.whatsAppSender.sendText(session.customerPhone, confirmationLines.join('\n'))
    } catch (error) {
      await this.handleConfirmOrderError(session, cart.id, error)
    }
  }

  /**
   * O troco foi validado contra o total da hora em que foi pedido; se um preço mudou enquanto o
   * cliente estava em CONFIRMING, o pedido sairia com troco menor que o cobrado. Revalida aqui e,
   * se não cobre mais, volta à pergunta do valor em vez de criar o pedido.
   */
  private async askCashChangeAgainIfTotalChanged(params: AskCashChangeAgainParams): Promise<boolean> {
    const { session, cartId, checkoutContext, deliveryFeeInCents } = params
    const cashChangeForInCents = checkoutContext.checkoutCashChangeForInCents
    if (cashChangeForInCents === undefined || cashChangeForInCents === null) return false

    const cartTotalInCents = await calculateCartTotalInCents({
      cartId,
      cartRepository: this.dependencies.cartRepository,
      productRepository: this.dependencies.productRepository,
    })
    const currentAmountDueInCents = amountDueInCents({ totalInCents: cartTotalInCents, deliveryFeeInCents })
    if (cashChangeForInCents > currentAmountDueInCents) return false

    await this.dependencies.conversationSessionRepository.updateStateByPhone({
      customerPhone: session.customerPhone,
      currentState: CONVERSATION_STATE.AWAITING_CASH_CHANGE_AMOUNT,
      context: checkoutContext,
    })
    await this.dependencies.whatsAppSender.sendText(
      session.customerPhone,
      MESSAGES.CHECKOUT_CASH_CHANGE_TOTAL_CHANGED.replace('{total}', formatPriceInCents(currentAmountDueInCents)),
    )
    return true
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

  /**
   * Roteiro §12. Calculada DEPOIS de criar o pedido; nunca atrasa nem derruba a confirmação.
   *
   * `try/catch` só em volta desta chamada (fallback gracioso, code-standart.md §7): sem `STORE_CEP`,
   * sem coordenada do cliente, fora do raio ou com o serviço de mapa fora do ar, a linha some e o
   * log carrega só o `orderId` — nunca telefone, endereço ou CEP (security.md §1).
   */
  private async buildDeliveryEstimateLine(order: OrderRecord): Promise<string | undefined> {
    if (order.deliveryType === DELIVERY_TYPE.PICKUP) {
      return MESSAGES.ORDER_CONFIRMED_PICKUP_ESTIMATE_LINE.replace(
        '{minutos}',
        String(this.dependencies.storePreparationMinutes),
      )
    }

    try {
      const estimate = await this.dependencies.resolveOrderDeliveryEstimateUseCase.execute({ order })
      if (!estimate || estimate.isOutsideRadius || estimate.minMinutes === undefined || estimate.maxMinutes === undefined) {
        return undefined
      }

      return MESSAGES.ORDER_CONFIRMED_DELIVERY_ESTIMATE_LINE.replace('{min}', String(estimate.minMinutes)).replace(
        '{max}',
        String(estimate.maxMinutes),
      )
    } catch (error: unknown) {
      checkoutLog.warn('delivery_estimate_unavailable', { orderId: order.id, error: serializeError(error) })
      return undefined
    }
  }

  private isKnownButtonId(buttonIdMap: Record<string, string>, buttonId: string): boolean {
    return Object.values(buttonIdMap).includes(buttonId)
  }
}
