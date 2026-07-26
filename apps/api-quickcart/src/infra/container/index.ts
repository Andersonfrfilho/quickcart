/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Container de injeção de dependência manual: instancia repositórios, use-cases e
 * controllers uma única vez por processo e expõe tudo como um objeto plano.
 */

import { DatabaseHealthChecker } from '@/infra/database/DatabaseHealthChecker'
import { RedisHealthChecker } from '@/infra/redis/RedisHealthChecker'
import { GetHealthStatusUseCase } from '@/modules/health/application/use-cases/GetHealthStatus.use-case'
import { HealthController } from '@/modules/health/infra/http/Health.controller'
import type { CategoryRepositoryInterface } from '@/modules/catalog/domain/CategoryRepository.interface'
import type { ProductRepositoryInterface } from '@/modules/catalog/domain/ProductRepository.interface'
import { DrizzleCategoryRepository } from '@/modules/catalog/infra/database/DrizzleCategoryRepository'
import { DrizzleProductRepository } from '@/modules/catalog/infra/database/DrizzleProductRepository'
import { AdjustStockUseCase } from '@/modules/catalog/application/use-cases/AdjustStock.use-case'
import { CreateCategoryUseCase } from '@/modules/catalog/application/use-cases/CreateCategory.use-case'
import { CreateProductUseCase } from '@/modules/catalog/application/use-cases/CreateProduct.use-case'
import { ListCategoriesUseCase } from '@/modules/catalog/application/use-cases/ListCategories.use-case'
import { ListProductsUseCase } from '@/modules/catalog/application/use-cases/ListProducts.use-case'
import { SearchProductsUseCase } from '@/modules/catalog/application/use-cases/SearchProducts.use-case'
import { UpdateProductUseCase } from '@/modules/catalog/application/use-cases/UpdateProduct.use-case'
import { CategoryController } from '@/modules/catalog/infra/http/Category.controller'
import { ProductController } from '@/modules/catalog/infra/http/Product.controller'
import { RedisProvider } from '@/infra/redis/RedisProvider'
import type { CacheProvider } from '@/shared/providers/CacheProvider.interface'
import type { CustomerRepositoryInterface } from '@/modules/webhook/domain/CustomerRepository.interface'
import type { ConversationSessionRepositoryInterface } from '@/modules/webhook/domain/ConversationSessionRepository.interface'
import type { MessageRepositoryInterface } from '@/modules/webhook/domain/MessageRepository.interface'
import { DrizzleCustomerRepository } from '@/modules/webhook/infra/database/DrizzleCustomerRepository'
import { DrizzleConversationSessionRepository } from '@/modules/webhook/infra/database/DrizzleConversationSessionRepository'
import { DrizzleMessageRepository } from '@/modules/webhook/infra/database/DrizzleMessageRepository'
import { createQuickCartWhatsAppModule } from '@/modules/webhook/infra/whatsapp/metaWhatsAppModule'
import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import { ConversationController } from '@/modules/conversation/infra/http/Conversation.controller'
import { ConversationSettingsController } from '@/modules/conversation/infra/http/ConversationSettings.controller'
import { ConversationStreamController } from '@/modules/conversation/infra/http/ConversationStream.controller'
import { conversationSseHub, conversationTicketStore } from '@/modules/conversation/infra/realtime/conversationRealtime'
import { WebhookController } from '@/modules/webhook/infra/http/Webhook.controller'
import { WhatsAppSender } from '@/modules/webhook/infra/whatsapp/WhatsAppSender'
import { ConversationEngine } from '@/modules/conversation/application/ConversationEngine'
import { MatchProductsUseCase } from '@/modules/conversation/application/use-cases/MatchProducts.use-case'
import { ParseShoppingListUseCase } from '@/modules/conversation/application/use-cases/ParseShoppingList.use-case'
import { GroqListRefinerProvider } from '@/modules/conversation/infra/providers/GroqListRefinerProvider'
import { DrizzleListImportRepository } from '@/modules/conversation/infra/database/DrizzleListImportRepository'
import { ProcessParsedListItems } from '@/modules/conversation/application/handlers/support/ProcessParsedListItems'
import { GreetingHandler } from '@/modules/conversation/application/handlers/GreetingHandler'
import { MenuHandler } from '@/modules/conversation/application/handlers/MenuHandler'
import { ListHandler } from '@/modules/conversation/application/handlers/ListHandler'
import { ResolveHandler } from '@/modules/conversation/application/handlers/ResolveHandler'
import { BrowseHandler } from '@/modules/conversation/application/handlers/BrowseHandler'
import { GlobalHandler } from '@/modules/conversation/application/handlers/GlobalHandler'
import { CartHandler } from '@/modules/conversation/application/handlers/CartHandler'
import { CheckoutHandler } from '@/modules/conversation/application/handlers/CheckoutHandler'
import { CONVERSATION_STATE } from '@/modules/conversation/shared/ConversationState.constant'
import type { CartRepositoryInterface } from '@/modules/cart/domain/CartRepository.interface'
import { DrizzleCartRepository } from '@/modules/cart/infra/database/DrizzleCartRepository'
import { AddCartItemUseCase } from '@/modules/cart/application/use-cases/AddCartItem.use-case'
import { RemoveCartItemUseCase } from '@/modules/cart/application/use-cases/RemoveCartItem.use-case'
import { UpdateCartItemQuantityUseCase } from '@/modules/cart/application/use-cases/UpdateCartItemQuantity.use-case'
import { GetOpenCartUseCase } from '@/modules/cart/application/use-cases/GetOpenCart.use-case'
import type { OrderRepositoryInterface } from '@/modules/order/domain/OrderRepository.interface'
import { DrizzleOrderRepository } from '@/modules/order/infra/database/DrizzleOrderRepository'
import { CreateOrderFromCartUseCase } from '@/modules/order/application/use-cases/CreateOrderFromCart.use-case'
import { CreateWebOrderUseCase } from '@/modules/order/application/use-cases/CreateWebOrder.use-case'
import { GetOrderByShortCodeUseCase } from '@/modules/order/application/use-cases/GetOrderByShortCode.use-case'
import { UpdateOrderStatusUseCase } from '@/modules/order/application/use-cases/UpdateOrderStatus.use-case'
import { RepeatLastOrderUseCase } from '@/modules/order/application/use-cases/RepeatLastOrder.use-case'
import { ListOrdersUseCase } from '@/modules/order/application/use-cases/ListOrders.use-case'
import { OrderController } from '@/modules/order/infra/http/Order.controller'
import { ResumeConversationUseCase } from '@/modules/webhook/application/use-cases/ResumeConversation.use-case'
import { InternalController } from '@/modules/internal/infra/http/Internal.controller'
import { sttQueue, receiptQueue, notificationQueue } from '@/infra/queue/queues'

type HealthModule = {
  readonly controller: HealthController
}

function buildHealthModule(): HealthModule {
  const databaseHealthChecker = new DatabaseHealthChecker()
  const cacheHealthChecker = new RedisHealthChecker()
  const getHealthStatusUseCase = new GetHealthStatusUseCase({ databaseHealthChecker, cacheHealthChecker })
  const controller = new HealthController(getHealthStatusUseCase)

  return { controller }
}

type CatalogModule = {
  readonly categoryController: CategoryController
  readonly productController: ProductController
  readonly categoryRepository: CategoryRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
}

function buildCatalogModule(): CatalogModule {
  const categoryRepository = new DrizzleCategoryRepository()
  const productRepository = new DrizzleProductRepository()

  const createCategoryUseCase = new CreateCategoryUseCase({ categoryRepository })
  const listCategoriesUseCase = new ListCategoriesUseCase({ categoryRepository })
  const createProductUseCase = new CreateProductUseCase({ categoryRepository, productRepository })
  const updateProductUseCase = new UpdateProductUseCase({ categoryRepository, productRepository })
  const adjustStockUseCase = new AdjustStockUseCase({ productRepository })
  const listProductsUseCase = new ListProductsUseCase({ productRepository })
  const searchProductsUseCase = new SearchProductsUseCase({ productRepository })

  const categoryController = new CategoryController({ createCategoryUseCase, listCategoriesUseCase })
  const productController = new ProductController({
    listProductsUseCase,
    searchProductsUseCase,
    createProductUseCase,
    updateProductUseCase,
    adjustStockUseCase,
  })

  return { categoryController, productController, categoryRepository, productRepository }
}

type CartModuleDependencies = {
  readonly productRepository: ProductRepositoryInterface
}

type CartModule = {
  readonly cartRepository: CartRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
  readonly removeCartItemUseCase: RemoveCartItemUseCase
  readonly updateCartItemQuantityUseCase: UpdateCartItemQuantityUseCase
  readonly getOpenCartUseCase: GetOpenCartUseCase
}

function buildCartModule(dependencies: CartModuleDependencies): CartModule {
  const cartRepository = new DrizzleCartRepository()

  const addCartItemUseCase = new AddCartItemUseCase({ cartRepository, productRepository: dependencies.productRepository })
  const removeCartItemUseCase = new RemoveCartItemUseCase({ cartRepository })
  const updateCartItemQuantityUseCase = new UpdateCartItemQuantityUseCase({ cartRepository })
  const getOpenCartUseCase = new GetOpenCartUseCase({ cartRepository })

  return { cartRepository, addCartItemUseCase, removeCartItemUseCase, updateCartItemQuantityUseCase, getOpenCartUseCase }
}

type OrderModuleDependencies = {
  readonly cartRepository: CartRepositoryInterface
  readonly productRepository: ProductRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
  readonly cacheProvider: CacheProvider
}

type OrderModule = {
  readonly orderRepository: OrderRepositoryInterface
  readonly createOrderFromCartUseCase: CreateOrderFromCartUseCase
  readonly createWebOrderUseCase: CreateWebOrderUseCase
  readonly getOrderByShortCodeUseCase: GetOrderByShortCodeUseCase
  readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
  readonly repeatLastOrderUseCase: RepeatLastOrderUseCase
  readonly listOrdersUseCase: ListOrdersUseCase
  readonly orderController: OrderController
}

function buildOrderModule(dependencies: OrderModuleDependencies): OrderModule {
  const orderRepository = new DrizzleOrderRepository()

  const createOrderFromCartUseCase = new CreateOrderFromCartUseCase({
    orderRepository,
    cartRepository: dependencies.cartRepository,
    productRepository: dependencies.productRepository,
    receiptQueue,
  })
  const createWebOrderUseCase = new CreateWebOrderUseCase({
    orderRepository,
    productRepository: dependencies.productRepository,
    customerRepository: dependencies.customerRepository,
    cacheProvider: dependencies.cacheProvider,
    receiptQueue,
  })
  const getOrderByShortCodeUseCase = new GetOrderByShortCodeUseCase({
    orderRepository,
    customerRepository: dependencies.customerRepository,
  })
  const updateOrderStatusUseCase = new UpdateOrderStatusUseCase({ orderRepository, notificationQueue })
  const repeatLastOrderUseCase = new RepeatLastOrderUseCase({
    orderRepository,
    cartRepository: dependencies.cartRepository,
    productRepository: dependencies.productRepository,
  })
  const listOrdersUseCase = new ListOrdersUseCase({ orderRepository })

  const orderController = new OrderController({
    createWebOrderUseCase,
    getOrderByShortCodeUseCase,
    listOrdersUseCase,
    updateOrderStatusUseCase,
  })

  return {
    orderRepository,
    createOrderFromCartUseCase,
    createWebOrderUseCase,
    getOrderByShortCodeUseCase,
    updateOrderStatusUseCase,
    repeatLastOrderUseCase,
    listOrdersUseCase,
    orderController,
  }
}

type WebhookRepositories = {
  readonly cacheProvider: CacheProvider
  readonly customerRepository: CustomerRepositoryInterface
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly messageRepository: MessageRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
}

function buildWebhookRepositories(): WebhookRepositories {
  const cacheProvider = new RedisProvider()
  const customerRepository = new DrizzleCustomerRepository()
  const conversationSessionRepository = new DrizzleConversationSessionRepository()
  const messageRepository = new DrizzleMessageRepository()
  const whatsAppSender = new WhatsAppSender({ messageRepository, conversationSessionRepository })

  return { cacheProvider, customerRepository, conversationSessionRepository, messageRepository, whatsAppSender }
}

type ConversationModuleDependencies = {
  readonly productRepository: ProductRepositoryInterface
  readonly categoryRepository: CategoryRepositoryInterface
  readonly customerRepository: CustomerRepositoryInterface
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly cartRepository: CartRepositoryInterface
  readonly addCartItemUseCase: AddCartItemUseCase
  readonly removeCartItemUseCase: RemoveCartItemUseCase
  readonly updateCartItemQuantityUseCase: UpdateCartItemQuantityUseCase
  readonly createOrderFromCartUseCase: CreateOrderFromCartUseCase
  readonly repeatLastOrderUseCase: RepeatLastOrderUseCase
}

type ConversationModule = {
  readonly conversationEngine: ConversationEngine
}

function buildConversationModule(dependencies: ConversationModuleDependencies): ConversationModule {
  const {
    productRepository,
    categoryRepository,
    customerRepository,
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    addCartItemUseCase,
    removeCartItemUseCase,
    updateCartItemQuantityUseCase,
    createOrderFromCartUseCase,
    repeatLastOrderUseCase,
  } = dependencies

  const matchProductsUseCase = new MatchProductsUseCase(productRepository)
  const parseShoppingListUseCase = new ParseShoppingListUseCase(new GroqListRefinerProvider())
  const listImportRepository = new DrizzleListImportRepository()

  const processParsedListItems = new ProcessParsedListItems({
    matchProductsUseCase,
    conversationSessionRepository,
    whatsAppSender,
    listImportRepository,
    cartRepository,
    productRepository,
    addCartItemUseCase,
  })

  const greetingHandler = new GreetingHandler({ conversationSessionRepository, whatsAppSender })
  const menuHandler = new MenuHandler({
    conversationSessionRepository,
    whatsAppSender,
    categoryRepository,
    parseShoppingListUseCase,
    processParsedListItems,
  })
  const listHandler = new ListHandler({ parseShoppingListUseCase, processParsedListItems, whatsAppSender, sttQueue })
  const resolveHandler = new ResolveHandler({
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    productRepository,
    addCartItemUseCase,
  })
  const browseHandler = new BrowseHandler({
    conversationSessionRepository,
    whatsAppSender,
    productRepository,
    cartRepository,
    addCartItemUseCase,
  })
  const cartHandler = new CartHandler({
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    productRepository,
    removeCartItemUseCase,
    updateCartItemQuantityUseCase,
  })
  const checkoutHandler = new CheckoutHandler({
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    productRepository,
    customerRepository,
    createOrderFromCartUseCase,
  })
  const globalHandler = new GlobalHandler({
    conversationSessionRepository,
    whatsAppSender,
    cartRepository,
    productRepository,
    repeatLastOrderUseCase,
  })

  const conversationEngine = new ConversationEngine({
    conversationSessionRepository,
    customerRepository,
    whatsAppSender,
    globalHandler,
    handlers: {
      [CONVERSATION_STATE.GREETING]: greetingHandler,
      [CONVERSATION_STATE.MAIN_MENU]: menuHandler,
      [CONVERSATION_STATE.AWAITING_LIST]: listHandler,
      [CONVERSATION_STATE.RESOLVING_ITEMS]: resolveHandler,
      [CONVERSATION_STATE.BROWSING_CATEGORIES]: browseHandler,
      [CONVERSATION_STATE.AWAITING_QUANTITY]: browseHandler,
      [CONVERSATION_STATE.CART_REVIEW]: cartHandler,
      [CONVERSATION_STATE.EDITING_CART]: cartHandler,
      [CONVERSATION_STATE.AWAITING_DELIVERY_TYPE]: checkoutHandler,
      [CONVERSATION_STATE.AWAITING_ADDRESS]: checkoutHandler,
      [CONVERSATION_STATE.AWAITING_PAYMENT]: checkoutHandler,
      [CONVERSATION_STATE.AWAITING_RECEIPT_PREFERENCE]: checkoutHandler,
      [CONVERSATION_STATE.AWAITING_EMAIL]: checkoutHandler,
      [CONVERSATION_STATE.CONFIRMING]: checkoutHandler,
    },
  })

  return { conversationEngine }
}

type WebhookModule = {
  readonly controller: WebhookController
  readonly whatsAppSender: WhatsAppSender
  // A mesma instância do módulo serve o webhook e as telas de conversa: são duas portas de
  // entrada para o mesmo estado, e duplicar a instância duplicaria pool e inscrições SSE.
  readonly metaWhatsApp: MetaWhatsAppModule
}

function buildWebhookModule(params: WebhookRepositories & ConversationModule): WebhookModule {
  const { cacheProvider, customerRepository, whatsAppSender, conversationEngine } = params

  const metaWhatsApp = createQuickCartWhatsAppModule({
    cacheProvider,
    customerRepository,
    resolveConversationEngine: () => conversationEngine,
  })

  const controller = new WebhookController({ metaWhatsApp })

  return { controller, whatsAppSender, metaWhatsApp }
}

type ConversationHttpModule = {
  readonly conversationController: ConversationController
  readonly settingsController: ConversationSettingsController
  readonly streamController: ConversationStreamController
}

function buildConversationHttpModule(params: { readonly metaWhatsApp: MetaWhatsAppModule }): ConversationHttpModule {
  return {
    conversationController: new ConversationController({ metaWhatsApp: params.metaWhatsApp }),
    settingsController: new ConversationSettingsController({ metaWhatsApp: params.metaWhatsApp }),
    streamController: new ConversationStreamController({
      sseHub: conversationSseHub,
      ticketStore: conversationTicketStore,
    }),
  }
}

type InternalModuleDependencies = {
  readonly conversationSessionRepository: ConversationSessionRepositoryInterface
  readonly messageRepository: MessageRepositoryInterface
  readonly whatsAppSender: WhatsAppSender
  readonly conversationEngine: ConversationEngine
}

type InternalModule = {
  readonly controller: InternalController
}

function buildInternalModule(dependencies: InternalModuleDependencies): InternalModule {
  const { conversationSessionRepository, messageRepository, whatsAppSender, conversationEngine } = dependencies

  const resumeConversationUseCase = new ResumeConversationUseCase({
    conversationSessionRepository,
    messageRepository,
    whatsAppSender,
    conversationEngine,
  })

  const controller = new InternalController({ resumeConversationUseCase })

  return { controller }
}

const catalogModule = buildCatalogModule()
const cartModule = buildCartModule({ productRepository: catalogModule.productRepository })
const webhookRepositories = buildWebhookRepositories()
const orderModule = buildOrderModule({
  cartRepository: cartModule.cartRepository,
  productRepository: catalogModule.productRepository,
  customerRepository: webhookRepositories.customerRepository,
  cacheProvider: webhookRepositories.cacheProvider,
})
const conversationModule = buildConversationModule({
  productRepository: catalogModule.productRepository,
  categoryRepository: catalogModule.categoryRepository,
  customerRepository: webhookRepositories.customerRepository,
  conversationSessionRepository: webhookRepositories.conversationSessionRepository,
  whatsAppSender: webhookRepositories.whatsAppSender,
  cartRepository: cartModule.cartRepository,
  addCartItemUseCase: cartModule.addCartItemUseCase,
  removeCartItemUseCase: cartModule.removeCartItemUseCase,
  updateCartItemQuantityUseCase: cartModule.updateCartItemQuantityUseCase,
  createOrderFromCartUseCase: orderModule.createOrderFromCartUseCase,
  repeatLastOrderUseCase: orderModule.repeatLastOrderUseCase,
})

const webhookModule = buildWebhookModule({ ...webhookRepositories, ...conversationModule })

export const container = {
  health: buildHealthModule(),
  catalog: { categoryController: catalogModule.categoryController, productController: catalogModule.productController },
  cart: {
    addCartItemUseCase: cartModule.addCartItemUseCase,
    removeCartItemUseCase: cartModule.removeCartItemUseCase,
    updateCartItemQuantityUseCase: cartModule.updateCartItemQuantityUseCase,
    getOpenCartUseCase: cartModule.getOpenCartUseCase,
  },
  order: {
    createOrderFromCartUseCase: orderModule.createOrderFromCartUseCase,
    createWebOrderUseCase: orderModule.createWebOrderUseCase,
    getOrderByShortCodeUseCase: orderModule.getOrderByShortCodeUseCase,
    updateOrderStatusUseCase: orderModule.updateOrderStatusUseCase,
    repeatLastOrderUseCase: orderModule.repeatLastOrderUseCase,
    listOrdersUseCase: orderModule.listOrdersUseCase,
    orderController: orderModule.orderController,
  },
  webhook: webhookModule,
  conversationHttp: buildConversationHttpModule({ metaWhatsApp: webhookModule.metaWhatsApp }),
  internal: buildInternalModule({
    conversationSessionRepository: webhookRepositories.conversationSessionRepository,
    messageRepository: webhookRepositories.messageRepository,
    whatsAppSender: webhookRepositories.whatsAppSender,
    conversationEngine: conversationModule.conversationEngine,
  }),
}
