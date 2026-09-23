/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O hub saiu daqui para `infra/realtime` quando a tela de separação passou a precisar do mesmo
 * mecanismo: manter dois hubs seria manter dois conjuntos de listeners sobre o mesmo Redis, e o
 * canal `order:<id>` acabaria com um relay próprio sem motivo.
 *
 * Os nomes antigos continuam porque é assim que o módulo de conversa chama o que usa.
 */

export { sseHub as conversationSseHub, sseTicketStore as conversationTicketStore } from '@/infra/realtime/sseHub'
