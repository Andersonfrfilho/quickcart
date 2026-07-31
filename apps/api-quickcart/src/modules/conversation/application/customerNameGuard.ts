/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Aceita ou recusa o que o cliente respondeu como nome.
 *
 * Fica separado das ações do fluxo porque é regra pura — entra texto, sai veredito — e é a única
 * parte da coleta de nome que compensa testar sem banco, sem WhatsApp e sem grafo.
 */

import { createTextModerator, parseTermList } from '@adatechnology/text-moderation'
import { environment } from '@/infra/config/environment'

/**
 * Moderador PRÓPRIO, sempre ligado — de propósito diferente do de `metaWhatsAppModule`.
 *
 * Lá o `MODERATION_ENABLED` governa *marcar mensagem ofensiva no transcript*, que é decisão de
 * operação: a loja pode preferir não etiquetar o que o cliente escreve. Recusar xingamento como
 * NOME é outra coisa — é validação de entrada, e desligá-la junto deixaria "Fdp" virar o nome que
 * aparece no painel, na etiqueta de entrega e na nota. Um interruptor para dois assuntos faria a
 * loja escolher entre não etiquetar o transcript e aceitar qualquer palavra como nome.
 *
 * Reaproveita `MODERATION_EXTRA_TERMS`/`ALLOWED_TERMS`: se a loja já curou essa lista, ela vale
 * aqui também.
 */
const nameModerator = createTextModerator({
  isEnabled: true,
  extraTerms: parseTermList(environment.MODERATION_EXTRA_TERMS),
  allowedTerms: parseTermList(environment.MODERATION_ALLOWED_TERMS),
})

/** Duas letras: cobre "Ed" e "Jô" sem aceitar "a" nem pontuação solta. */
const MIN_NAME_LENGTH = 2

/**
 * Teto do que cabe em `customers.name` (varchar(120)).
 *
 * Corta em vez de recusar: quem manda uma frase inteira ("meu nome é João e eu queria...") está
 * respondendo de boa fé, e recusar por comprimento seria punir o jeito de falar. O primeiro nome
 * é extraído antes disso.
 */
const MAX_NAME_LENGTH = 120

export type NameVerdict =
  | { readonly kind: 'accepted'; readonly name: string }
  | { readonly kind: 'rejected'; readonly reason: 'offensive' | 'too-short' }

/**
 * Tira o nome de uma resposta em linguagem natural.
 *
 * O cliente raramente responde só "João" — vem "sou o João", "meu nome é João", "aqui é o João da
 * padaria". Isso importa mais depois que áudio entrou no fluxo: transcrição de fala é sempre frase
 * inteira, nunca uma palavra.
 */
function extractName(raw: string): string {
  const withoutPrefix = raw
    .trim()
    .replace(/^(oi|ol[áa]|bom dia|boa tarde|boa noite)[\s,!.]*/iu, '')
    .replace(/^(aqui )?(quem fala )?[éeh]\s+(o|a)\s+/iu, '')
    .replace(/^(meu nome (é|eh)|me chamo|sou (o|a)|sou|eu sou (o|a)|eu sou)\s+/iu, '')
    .trim()

  // Pontuação de fim de frase sobra na transcrição de áudio ("Sou o João.") e viraria parte do nome.
  return withoutPrefix.replace(/[.,;!?]+$/u, '').slice(0, MAX_NAME_LENGTH).trim()
}

/** Capitaliza cada palavra: "joão pedro" → "João Pedro". A transcrição costuma vir em caixa baixa. */
function toDisplayName(name: string): string {
  return name
    .split(/\s+/u)
    .map((word) => (word.length > 0 ? word[0]!.toLocaleUpperCase('pt-BR') + word.slice(1) : word))
    .join(' ')
}

export function judgeCustomerName(raw: string | undefined): NameVerdict {
  const name = extractName(raw ?? '')

  if (name.length < MIN_NAME_LENGTH) return { kind: 'rejected', reason: 'too-short' }

  /**
   * Inspeciona o nome EXTRAÍDO, não a frase crua.
   *
   * O pacote casa por palavra inteira justamente para não rejeitar "Paulo" por conter `pau` nem
   * "Ana Cunha" e "Marcus" por conterem `cu` — Paulo e Paula estão entre os nomes mais comuns do
   * Brasil, e um filtro por substring barraria cliente legítimo em silêncio.
   */
  if (nameModerator.inspect(name).isOffensive) return { kind: 'rejected', reason: 'offensive' }

  return { kind: 'accepted', name: toDisplayName(name) }
}
