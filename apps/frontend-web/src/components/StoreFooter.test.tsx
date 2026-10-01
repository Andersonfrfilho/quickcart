/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it, mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

mock.module('@/app/router', () => ({
  useRouter: () => ({
    currentPath: '/',
    navigate: () => {},
    params: {},
    searchParams: new URLSearchParams(),
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

mock.module('@/modules/store/shared/cartStore', () => ({
  useCartStore: (selector: (state: { items: unknown[] }) => unknown) => selector({ items: [] }),
}))

const { StoreFooter, StoreLayout } = await import('./Layout')

const footerHtml = renderToStaticMarkup(<StoreFooter />)

describe('StoreFooter', () => {
  /**
   * A revisão do nome de exibição da Meta abre a loja pública e procura a ligação entre o nome
   * pedido e o Portfólio Empresarial. O painel já assinava na barra lateral, que ninguém de fora
   * enxerga — tirar esta frase daqui reprova o nome sem erro nenhum aparecer no build.
   */
  it('nomeia quem fornece a plataforma, com a frase que a revisão procura', () => {
    expect(footerHtml).toContain('Uma solução tecnológica')
    expect(footerHtml).toContain('Ada Technology')
    expect(footerHtml).toContain('https://adatechnology.com.br')
  })

  /** Sem `noreferrer` a aba aberta herda `window.opener` e pode reescrever a loja. */
  it('o link que abre em outra aba corta o vínculo com a origem', () => {
    expect(footerHtml).toContain('rel="noreferrer"')
    expect(footerHtml).toContain('target="_blank"')
  })

  it('o copyright continua sendo da loja, não do fornecedor', () => {
    expect(footerHtml).toContain(`${new Date().getFullYear()} QuickCart`)
    expect(footerHtml).toContain('Todos os direitos reservados')
  })
})

describe('StoreLayout', () => {
  /** Testar só o componente deixaria passar removerem `<StoreFooter />` da loja. */
  it('assina a loja pública, e não só o painel', () => {
    const html = renderToStaticMarkup(
      <StoreLayout>
        <p>conteúdo</p>
      </StoreLayout>,
    )

    expect(html).toContain('Uma solução tecnológica')
    expect(html).toContain('https://adatechnology.com.br')
  })
})
