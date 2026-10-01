/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Base URL, timeout e nome do provedor compartilhados entre os dois usos da BrasilAPI
 * (geocodificação e endereço): mesmo host, mesma política de timeout — declarar duas vezes
 * seria a mesma constante divergindo silenciosamente no dia em que uma delas mudasse.
 */

export const BRASIL_API_CEP_URL = 'https://brasilapi.com.br/api/cep/v2'

/** Uma resposta lenta não pode segurar a cotação do cliente nem a fila de quem vem atrás. */
export const BRASIL_API_REQUEST_TIMEOUT_MS = 3000

export const BRASIL_API_PROVIDER_NAME = 'brasilapi'
