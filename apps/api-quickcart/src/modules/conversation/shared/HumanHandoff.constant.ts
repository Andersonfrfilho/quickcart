/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

/** Cooldown do pedido de atendente: mesmo telefone em modo bot não reenfileira antes disto. */
export const HUMAN_HANDOFF_COOLDOWN_KEY_PREFIX = 'conversation:human-handoff-cooldown'
export const HUMAN_HANDOFF_COOLDOWN_SECONDS = 10 * 60
export const HUMAN_HANDOFF_COOLDOWN_STORE_FAILED_LOG_EVENT = 'human_handoff_cooldown_store_failed'
