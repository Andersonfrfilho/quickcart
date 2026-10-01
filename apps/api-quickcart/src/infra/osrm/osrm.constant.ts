/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Servidor de demonstração pública do OSRM: sem chave, sem custo, sem SLA — por isso o timeout é
 * curto e o provedor nunca é a única fonte de distância (ver `OsrmRoutingProvider`).
 */

export const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving'

/** Uma resposta lenta não pode segurar a cotação do cliente nem a fila de quem vem atrás. */
export const OSRM_REQUEST_TIMEOUT_MS = 3000

export const OSRM_PROVIDER_NAME = 'osrm'
