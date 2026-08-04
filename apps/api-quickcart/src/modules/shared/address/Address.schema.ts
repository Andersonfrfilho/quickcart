/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A única definição de endereço do sistema — usada pelo pedido, pelo cliente e pela loja.
 *
 * Antes, os dois canais gravavam formatos diferentes no mesmo campo `jsonb`: o web mandava
 * `{ street: "texto digitado num input único" }`, o WhatsApp mandava a mensagem crua
 * (`message.body.trim()`). Não existe caminho de "manda na rua de trás do posto" para uma
 * coordenada — estruturar o endereço não é preparação para distância/ETA, é a feature.
 */

import { z } from 'zod'

/** Como a coordenada foi obtida — varia demais para tratar toda coordenada com a mesma confiança. */
export const GEOCODE_PRECISION = {
  /** ~100–500 m, o trecho da rua. CEP de logradouro em capital. */
  STREET: 'street',
  /** ~1 km. CEP de bairro. */
  POSTAL_CODE: 'postal_code',
  /** A cidade inteira — pode errar quilômetros. CEP genérico `-000` de cidade pequena. */
  CITY: 'city',
  NONE: 'none',
} as const

export type GeocodePrecision = (typeof GEOCODE_PRECISION)[keyof typeof GEOCODE_PRECISION]

/**
 * O endereço, e SÓ o endereço: sem coordenada.
 *
 * `number` é string de propósito — "s/n" e "123A" são endereços reais, e `integer` os rejeitaria.
 *
 * A spec §3 previa `latitude`, `longitude` e `geocodePrecision` aqui dentro, e eles existiram até a
 * revisão final da feature mostrar que ninguém os escrevia nem lia: a coordenada mora em
 * `geocoded_addresses`, indexada por CEP, porque é o CEP que a determina — dois clientes do mesmo
 * prédio têm a mesma. Duplicá-la dentro de cada pedido criaria duas verdades que podem discordar, e
 * a de dentro do `jsonb` nunca seria atualizada.
 *
 * Como consequência, o cliente também não tem onde injetar coordenada: zod descarta chave que o
 * schema não declara, então mandar `latitude` no corpo da requisição não muda nada.
 */
export const addressSchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP precisa ter 8 dígitos'),
  street: z.string().min(1).max(160),
  number: z.string().min(1).max(20),
  complement: z.string().max(80).optional(),
  neighborhood: z.string().min(1).max(80),
  city: z.string().min(1).max(80),
  state: z.string().length(2),
  /** "portão azul ao lado da padaria" — em entrega de bairro costuma valer mais que o número. */
  reference: z.string().max(160).optional(),
})

export type Address = z.infer<typeof addressSchema>

/**
 * Nome mantido nos pontos de entrada HTTP: lá o que importa é "isto é o que o cliente pode enviar",
 * e a intenção continua legível mesmo agora que nada precisa ser removido do schema base.
 */
export const addressInputSchema = addressSchema

export type AddressInput = z.infer<typeof addressInputSchema>
