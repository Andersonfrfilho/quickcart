/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Thresholds do spec §3.2. Caso não coberto pelo spec e confirmado com o usuário:
 * quando há apenas 1 candidato com score em [MATCH_MIN_THRESHOLD, MATCH_AUTO_THRESHOLD),
 * classifica como ambíguo (mostra a lista interativa com esse único candidato + "skip"),
 * em vez de descartar o item como não encontrado.
 */

export const MATCH_AUTO_THRESHOLD = 0.55
export const MATCH_GAP_THRESHOLD = 0.15
export const MATCH_MIN_THRESHOLD = 0.3
export const MATCH_MAX_CANDIDATES = 10
/**
 * Teto de candidatos ambíguos guardados na fila de resolução.
 *
 * A lista inteira vive em `pendingResolutions`, dentro do jsonb `conversation_sessions.context` —
 * sem teto, um termo genérico ("arroz") devolveria dezenas de linhas e infla essa coluna sem limite.
 * 50 cobre qualquer catálogo razoável em paginação de 10 sem aproximar do problema.
 */
export const MATCH_MAX_AMBIGUOUS_CANDIDATES = 50

export const MATCH_TYPE = {
  AUTO: 'auto',
  AMBIGUOUS: 'ambiguous',
  NOT_FOUND: 'not_found',
} as const

export type MatchType = (typeof MATCH_TYPE)[keyof typeof MATCH_TYPE]
