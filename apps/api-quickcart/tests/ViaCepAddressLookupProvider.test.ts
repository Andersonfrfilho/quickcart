/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * `fetch` global é o único colaborador — mockado aqui em vez de chamar o ViaCEP de verdade, para o
 * teste não depender de rede nem virar flaky quando o serviço estiver fora.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { ViaCepAddressLookupProvider } from '@/infra/viacep/ViaCepAddressLookupProvider'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function stubFetch(response: { ok: boolean; json?: () => Promise<unknown> }): void {
  globalThis.fetch = (async () => response) as typeof fetch
}

describe('ViaCepAddressLookupProvider', () => {
  it('devolve os campos quando o CEP resolve', async () => {
    stubFetch({
      ok: true,
      json: async () => ({ logradouro: 'Rua Bela Cintra', bairro: 'Consolação', localidade: 'São Paulo', uf: 'SP' }),
    })

    const result = await new ViaCepAddressLookupProvider().lookupByCep('01415-000')
    expect(result).toEqual({ street: 'Rua Bela Cintra', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP' })
  })

  it('devolve undefined quando o ViaCEP responde { erro: true } — CEP genérico ou inexistente', async () => {
    stubFetch({ ok: true, json: async () => ({ erro: true }) })
    expect(await new ViaCepAddressLookupProvider().lookupByCep('99999-999')).toBeUndefined()
  })

  it('devolve undefined quando logradouro vem vazio — CEP genérico de cidade pequena (spec §4.3)', async () => {
    // Medido na spec: CEP `-000` de cidade pequena devolve 200 sem `erro`, mas sem logradouro. Aceitar
    // isso construiria um addressInputSchema com `street` vazio, que o schema não deixaria passar de
    // qualquer forma — melhor falhar aqui e cair no texto livre do que montar um objeto inválido.
    stubFetch({ ok: true, json: async () => ({ bairro: '', localidade: 'Piumhi', uf: 'MG' }) })
    expect(await new ViaCepAddressLookupProvider().lookupByCep('37925-000')).toBeUndefined()
  })

  it('devolve undefined quando o CEP não tem 8 dígitos', async () => {
    expect(await new ViaCepAddressLookupProvider().lookupByCep('123')).toBeUndefined()
  })

  it('devolve undefined quando a resposta HTTP não é ok', async () => {
    stubFetch({ ok: false })
    expect(await new ViaCepAddressLookupProvider().lookupByCep('01415-000')).toBeUndefined()
  })

  it('devolve undefined em vez de lançar quando a rede falha', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as typeof fetch
    expect(await new ViaCepAddressLookupProvider().lookupByCep('01415-000')).toBeUndefined()
  })
})
