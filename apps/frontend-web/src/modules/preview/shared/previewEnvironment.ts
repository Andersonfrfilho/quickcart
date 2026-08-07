/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Portão do preview de conversa. Nenhum segredo mora aqui: o bundle não carrega mais o app secret,
 * porque toda assinatura do webhook é gerada no servidor. O que resta é configuração pública — de
 * que número o preview envia — e a habilitação, que exige DUAS condições independentes (build de
 * desenvolvimento E flag explícita), porque a rota de preview escreve no transcript de um cliente.
 *
 * Um app secret que já tenha sido publicado num bundle com prefixo `VITE_` está queimado e precisa
 * ser rotacionado — `VITE_*` é literal inlinado no JavaScript entregue.
 */

const PREVIEW_FLAG_ENABLED = 'true'

export const IS_PREVIEW_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_PREVIEW_ENABLED === PREVIEW_FLAG_ENABLED

export type PreviewEnvironment = {
  readonly inboundUrl: string
  readonly customerPhone: string
}

export class PreviewConfigurationError extends Error {
  constructor(missing: string) {
    super(`Preview habilitado sem ${missing}. Defina no .env.local a partir do envs/env.dev.`)
    this.name = 'PreviewConfigurationError'
  }
}

/**
 * Falha alto em vez de enviar com número vazio: sem o número, o webhook criaria uma conversa órfã e
 * quem depura iria investigar o motor em vez do próprio .env.
 */
export function readPreviewEnvironment(): PreviewEnvironment {
  const customerPhone = import.meta.env.VITE_PREVIEW_PHONE
  if (!customerPhone) throw new PreviewConfigurationError('VITE_PREVIEW_PHONE')

  const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

  // Não é o webhook direto: a rota de preview da API monta o payload e assina com o app secret que
  // só o servidor tem. O navegador manda a intenção, não a assinatura.
  return {
    inboundUrl: `${apiBaseUrl}/v1/preview/inbound`,
    customerPhone,
  }
}
