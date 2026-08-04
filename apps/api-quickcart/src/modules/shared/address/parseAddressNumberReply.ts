/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * "412, apto 71" → número e complemento. Regra estrutural única — o que vem antes da primeira
 * vírgula é o número, o resto é complemento — não interpretação de texto livre: o cliente foi
 * explicitamente instruído a responder nesse formato (CheckoutHandler, estado
 * `awaiting_address_number`), então isto só separa dois campos que ele já entregou juntos.
 */

export type ParsedAddressNumberReply = {
  readonly number: string
  readonly complement?: string
}

export function parseAddressNumberReply(reply: string): ParsedAddressNumberReply {
  const [numberPart, ...complementParts] = reply.split(',')
  const number = (numberPart ?? '').trim()
  const complement = complementParts.join(',').trim()

  return complement ? { number, complement } : { number }
}
