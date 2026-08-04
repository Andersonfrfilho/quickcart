/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Portão do preview de conversa. O preview cliente assina o webhook com o app secret de dev, o que
 * significa carregar um segredo no bundle — aceitável no docker local, inaceitável em qualquer
 * outro lugar. Por isso a habilitação exige DUAS condições independentes: build de desenvolvimento
 * E flag explícita. Uma sozinha é fácil demais de ligar por acidente.
 *
 * Restou APENAS para a aba do cliente (`CustomerPreview.page`), que não tem sessão de admin e por
 * isso se autentica por HMAC. O simulador do painel não passa mais por aqui: ele manda a intenção
 * para a API, que assina do lado do servidor. Qualquer app secret que já tenha sido publicado num
 * bundle com este prefixo deve ser tratado como queimado e rotacionado.
 */

const PREVIEW_FLAG_ENABLED = 'true'

export const IS_PREVIEW_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_PREVIEW_ENABLED === PREVIEW_FLAG_ENABLED

export type PreviewEnvironment = {
  readonly webhookUrl: string
  readonly appSecret: string
  readonly customerPhone: string
}

export class PreviewConfigurationError extends Error {
  constructor(missing: string) {
    super(`Preview habilitado sem ${missing}. Defina no .env.local a partir do envs/env.dev.`)
    this.name = 'PreviewConfigurationError'
  }
}

/**
 * Falha alto em vez de assinar com string vazia: um segredo ausente produziria assinatura inválida
 * e um 401 genérico, mandando quem depura investigar o webhook em vez do próprio .env.
 */
export function readPreviewEnvironment(): PreviewEnvironment {
  const appSecret = import.meta.env.VITE_PREVIEW_APP_SECRET
  if (!appSecret) throw new PreviewConfigurationError('VITE_PREVIEW_APP_SECRET')

  const customerPhone = import.meta.env.VITE_PREVIEW_PHONE
  if (!customerPhone) throw new PreviewConfigurationError('VITE_PREVIEW_PHONE')

  const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

  return {
    webhookUrl: `${apiBaseUrl}/v1/webhook/whatsapp`,
    appSecret,
    customerPhone,
  }
}
