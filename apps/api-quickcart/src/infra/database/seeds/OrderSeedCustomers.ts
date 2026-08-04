/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Clientes e pedidos de desenvolvimento, com endereços de CEP REAL espalhados por faixas de distância.
 *
 * Antes disto, os seeds cobriam catálogo e fluxo de conversa, mas nenhum cliente ou pedido — então a
 * tela de pedidos abria vazia e cada teste de layout começava fabricando dados por SQL. Foi assim que
 * um `QC-1003` inventado à mão terminou no banco de dev.
 *
 * As distâncias abaixo foram MEDIDAS (Nominatim + haversine × 1.35) a partir de `STORE_CEP=01415-000`,
 * a loja de dev na Consolação — não são estimativas de mapa mental. Elas cobrem de propósito os quatro
 * estados que a tela precisa saber mostrar, incluindo os dois que ninguém reproduz à mão: fora do raio
 * de entrega, e CEP genérico de cidade pequena, em que a coordenada é o centroide do município e a tela
 * mostra distância sem prometer horário.
 *
 * Telefones no padrão de teste (5511 9xxxx-xxxx) e nomes fictícios: seed não é lugar de dado de pessoa
 * real, e um número real receberia mensagem de verdade se o worker estiver rodando.
 */

export type OrderSeedCustomer = {
  readonly name: string
  readonly phone: string
  readonly deliveryType: 'delivery' | 'pickup'
  readonly address?: {
    readonly cep: string
    readonly street: string
    readonly number: string
    readonly complement?: string
    readonly neighborhood: string
    readonly city: string
    readonly state: string
    readonly reference?: string
  }
  readonly paymentMethod: 'pix' | 'card_on_delivery' | 'cash'
  /** Quantos produtos diferentes entram no pedido — lista longa é o caso difícil da tela de separação. */
  readonly itemCount: number
  /** Por que este cliente existe na seed. Vai para o log, não para o banco. */
  readonly purpose: string
}

export const SEED_ORDER_CUSTOMERS: readonly OrderSeedCustomer[] = [
  {
    name: 'Maria Aparecida da Silva',
    phone: '5511988887777',
    deliveryType: 'delivery',
    address: {
      cep: '01310-100',
      street: 'Avenida Paulista',
      number: '1578',
      complement: 'apto 71',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      reference: 'portão azul ao lado da banca',
    },
    paymentMethod: 'pix',
    itemCount: 12,
    purpose: 'perto (2,0 km medidos) e com lista longa — o caso comum bem resolvido',
  },
  {
    name: 'Antônio Carlos de Albuquerque Vasconcelos Neto',
    phone: '5511977776666',
    deliveryType: 'delivery',
    address: {
      cep: '04101-300',
      street: 'Rua Domingos de Morais',
      number: '1200',
      neighborhood: 'Vila Mariana',
      city: 'São Paulo',
      state: 'SP',
    },
    paymentMethod: 'card_on_delivery',
    itemCount: 4,
    // Nome comprido também: é o que estoura a largura da coluna de cliente na tabela.
    purpose: 'meia distância (6,3 km medidos), dentro do raio, com nome comprido',
  },
  {
    name: 'Joana Pires',
    phone: '5511966665555',
    deliveryType: 'delivery',
    address: {
      cep: '02011-000',
      street: 'Rua Voluntários da Pátria',
      number: '2000',
      complement: 'bloco B, apto 34',
      neighborhood: 'Santana',
      city: 'São Paulo',
      state: 'SP',
    },
    paymentMethod: 'cash',
    itemCount: 7,
    purpose: 'borda do raio (6,7 km medidos) — perto do limite sem passar dele',
  },
  {
    name: 'Rafael Souza',
    phone: '5511955554444',
    deliveryType: 'delivery',
    address: {
      cep: '09010-000',
      street: 'Rua Coronel Oliveira Lima',
      number: '150',
      neighborhood: 'Centro',
      city: 'Santo André',
      state: 'SP',
    },
    paymentMethod: 'pix',
    itemCount: 3,
    purpose: 'FORA do raio (23,7 km medidos) — exercita o aviso ao operador',
  },
  {
    name: 'Bianca Nogueira',
    phone: '5511944443333',
    deliveryType: 'delivery',
    address: {
      cep: '37925-000',
      street: 'Rua Sete de Setembro',
      number: 's/n',
      neighborhood: 'Centro',
      city: 'Piumhi',
      state: 'MG',
      reference: 'em frente à praça',
    },
    paymentMethod: 'pix',
    itemCount: 5,
    // `s/n` de propósito: número não numérico é endereço real, e é o que `integer` teria rejeitado.
    purpose: 'CEP genérico -000 (471,9 km, precisão de município) — distância aproximada, sem horário',
  },
  {
    name: 'Pedro Henrique Lima',
    phone: '5511933332222',
    deliveryType: 'pickup',
    paymentMethod: 'pix',
    itemCount: 6,
    purpose: 'retirada — a tela não deve mostrar endereço nem distância nenhuma',
  },
]
