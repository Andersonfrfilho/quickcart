/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Uma instância do cliente para o painel inteiro.
 *
 * `getAuthHeaders` é função e não valor: o token do admin vive no `sessionStorage` e é lido pelo
 * mesmo acessor que o login usa para gravar. Capturar o header no boot deixaria o cliente
 * autenticando com credencial de uma sessão anterior — e ler o storage direto aqui já causou
 * divergência real neste projeto (o login grava em `sessionStorage`, uma versão do cliente lia
 * `localStorage`, e toda chamada saía com token vazio).
 *
 * Base `/v1` e não `/v1/admin`: as rotas vêm do `notification-module`, montado com `basePath: '/v1'`
 * no `server.ts`. O prefixo `/admin` é das rotas próprias do quickcart.
 */

import { createNotificationClient } from '@adatechnology/notification-client'
import type { NotificationClient } from '@adatechnology/notification-client'

import { getAdminToken } from '@/modules/admin/shared/useAdminAuth.hook'

/**
 * `VITE_API_URL` é vazio por padrão neste projeto, de propósito: as chamadas saem same-origin e o
 * proxy `/v1` do `vite.config` encaminha para a api. Mas o cliente monta `new URL(...)`, que exige
 * base ABSOLUTA — com `/v1` ele lançava `Failed to construct 'URL': Invalid URL`, e o sintoma na
 * tela era "Carregando…" para sempre, sem uma única requisição no painel de rede.
 *
 * `window.location.origin` resolve os dois casos: same-origin em desenvolvimento, e a URL
 * configurada quando o front está em domínio separado da api.
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin

export const notificationClient: NotificationClient = createNotificationClient({
  baseUrl: `${API_BASE_URL}/v1`,
  getAuthHeaders: () => ({ authorization: `Bearer ${getAdminToken() ?? ''}` }),
})
