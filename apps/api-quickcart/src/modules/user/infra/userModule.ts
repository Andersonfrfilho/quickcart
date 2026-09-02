/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Toda a integração com o `@adatechnology/user-module`: schema, migrations, repositórios, hash de
 * senha, assinatura de JWT, rotação de refresh e reset por e-mail vêm do pacote.
 *
 * A escolha é autenticação LOCAL nesta fase, com o Keycloak previsto para depois. Trocar não muda
 * rota nem middleware: o pacote expõe `authenticateKeycloak` pelo mesmo `verifyAccessToken`, então
 * a troca é este arquivo e a variável de ambiente — nada acima disto conhece o provedor.
 *
 * O `sameSite` do cookie de refresh é de AMBIENTE, não de código: em `localhost` a tela e a api
 * compartilham o site registrável e `lax` protege sozinho; no staging elas são subdomínios de
 * `up.railway.app`, que está na Public Suffix List — logo cross-site, e `lax` não anexaria o cookie.
 */

import { createUserModule } from '@adatechnology/user-module'
import type { UserModule } from '@adatechnology/user-module'

import { db } from '@/infra/database/connection'
import { environment } from '@/infra/config/environment'

import { createSmtpEmailDriver } from './smtpEmailDriver'

/**
 * Loja única: o QuickCart não separa empresas, então a linha nunca carrega `company_id` e o escopo
 * é sempre `undefined`. `WHATSAPP_COMPANY_ID` é o identificador que os outros módulos já usam.
 */
function resolveTenancy() {
  return { mode: 'single', defaultCompanyId: environment.WHATSAPP_COMPANY_ID } as const
}

/**
 * Reset de senha existe só quando há SMTP configurado — sem servidor de e-mail não há para onde
 * mandar o link, e o pacote deixa de publicar as rotas (`hasPasswordReset`).
 */
function resolvePasswordReset() {
  if (!environment.USER_PASSWORD_RESET_URL_TEMPLATE) return undefined
  return {
    resetUrlTemplate: environment.USER_PASSWORD_RESET_URL_TEMPLATE,
    tokenExpiresInSeconds: environment.USER_RESET_TOKEN_EXPIRES_IN_SECONDS,
  }
}

/**
 * Memoizado: o módulo é caro de montar e precisa ser o MESMO em todo lugar — o boot monta as rotas
 * com ele, e cada `requireSession` verifica assinatura com ele. Duas instâncias funcionariam por
 * acidente (mesmo segredo) até alguém plugar um provedor com estado.
 */
let userModulePromise: Promise<UserModule> | undefined

export function getQuickCartUserModule(): Promise<UserModule> {
  userModulePromise ??= createQuickCartUserModule()
  return userModulePromise
}

export function createQuickCartUserModule(): Promise<UserModule> {
  const email = createSmtpEmailDriver()
  const passwordReset = email ? resolvePasswordReset() : undefined

  // Chave ausente e chave com `undefined` não são a mesma coisa sob `exactOptionalPropertyTypes`:
  // o pacote decide `hasPasswordReset`/`hasEmail` pela ausência, então a chave não pode existir.
  return createUserModule({
    db,
    config: {
      tenancy: resolveTenancy(),
      accessToken: {
        secret: environment.USER_ACCESS_TOKEN_SECRET,
        expiresInSeconds: environment.USER_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        issuer: 'quickcart',
        audience: 'quickcart',
      },
      refreshToken: {
        expiresInSeconds: environment.USER_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
        sameSite: environment.USER_REFRESH_COOKIE_SAME_SITE,
      },
      ...(passwordReset ? { passwordReset } : {}),
    },
    providers: { ...(email ? { email } : {}) },
  })
}
