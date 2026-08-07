/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Link de rota até o cliente. Fora do componente porque a decisão de o que mandar ao Maps é regra,
 * não apresentação — e é uma regra fácil de desfazer sem perceber (ver `buildMapsDestination`).
 */

/**
 * O endereço estruturado reconhecido pela FORMA, não por versão ou flag — mesma checagem que o
 * `OrderDetailView` faz para exibir. Nenhum formato antigo (string crua, `{ street: "..." }` do
 * checkout velho) tem os cinco campos obrigatórios juntos.
 */
export type StructuredAddress = {
  readonly cep?: string
  readonly street: string
  readonly number: string
  readonly complement?: string
  readonly neighborhood: string
  readonly city: string
  readonly state: string
  readonly reference?: string
}

export function isStructuredAddress(address: unknown): address is StructuredAddress {
  if (!address || typeof address !== 'object') return false
  const candidate = address as Record<string, unknown>
  return (
    typeof candidate.street === 'string' &&
    typeof candidate.number === 'string' &&
    typeof candidate.neighborhood === 'string' &&
    typeof candidate.city === 'string' &&
    typeof candidate.state === 'string'
  )
}

/**
 * Destino para o Maps — deliberadamente **não** a coordenada que o pedido já carrega.
 *
 * A nossa coordenada vem do CEP: no melhor caso é o trecho da rua e, quando o estimador marca
 * `isApproximate`, é o centroide do município. O Maps, recebendo o endereço com número,
 * geocodifica melhor do que nós — ele conhece numeração predial, e do CEP só se chega à quadra.
 * Mandar a nossa coordenada trocaria o resultado bom pelo pior, e no caso do centroide levaria o
 * entregador a quilômetros de distância.
 *
 * `complement` e `reference` ficam FORA: "apto 42" e "portão azul ao lado da padaria" são para o
 * humano que chega na porta, e como texto de busca só atrapalham o geocodificador. O CEP entra,
 * porque é o que desambigua rua de mesmo nome em cidade grande.
 */
export function buildMapsDestination(params: {
  readonly address: unknown
  readonly fallbackText?: string | undefined
}): string | undefined {
  if (isStructuredAddress(params.address)) {
    const { street, number, neighborhood, city, state, cep } = params.address
    return [`${street}, ${number}`, neighborhood, `${city} - ${state}`, cep].filter(Boolean).join(', ')
  }

  // Endereço legado é texto livre e pode não geocodificar. Mandar assim mesmo é melhor que esconder
  // o botão: quem vai entregar lê o resultado e decide, e o Maps errando é visível na hora.
  const fallback = params.fallbackText?.trim()
  return fallback && fallback.length > 0 ? fallback : undefined
}

/**
 * `dir` e não `search`: quem abre isso está indo entregar, e no celular a rota já sai traçada, com
 * um toque a menos. No desktop cai na mesma tela de direções.
 */
export function buildMapsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
