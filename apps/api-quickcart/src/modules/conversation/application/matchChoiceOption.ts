/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Casa uma resposta em texto livre com uma das opções de um nó de escolha.
 *
 * Existe porque o interpretador do grafo compara a resposta com o **id** da opção
 * (`next.byAnswer[answerId]`), e nem transcrição de áudio nem texto digitado jamais são iguais a um
 * id. Sem isto, quem responde o menu falando cai no `default` — que reenvia o menu — e o bot repete
 * a mesma pergunta para sempre.
 *
 * Casa por RÓTULO, não por lista de sinônimos fixa: os rótulos vêm do grafo que o lojista desenha no
 * editor, então uma tabela de sinônimos aqui só cobriria o menu que existia quando este arquivo foi
 * escrito.
 */

/** Palavras curtas não distinguem opção ("ver", "meu", "de") e casariam com qualquer coisa. */
const MIN_SIGNIFICANT_WORD_LENGTH = 4

/** Remove acento, emoji e pontuação — "🛒 Ver Produtos" e "ver produtos" precisam bater. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    // Range explícito em vez de marcas literais: caractere combinante no código-fonte é invisível
    // no editor e some numa cópia descuidada, levando o regex a não casar nada em silêncio.
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function significantWords(label: string): string[] {
  return normalize(label)
    .split(' ')
    .filter((word) => word.length >= MIN_SIGNIFICANT_WORD_LENGTH)
}

/**
 * Devolve o id da opção que a resposta indica, ou `undefined` quando não dá para afirmar.
 *
 * **Empate devolve `undefined` de propósito.** Adivinhar entre duas opções manda o cliente para o
 * caminho errado — ele vai descobrir isso três telas depois, sem entender o que aconteceu. Repetir a
 * pergunta custa uma mensagem; um pedido montado errado custa a compra.
 */
export function matchChoiceOption(
  answer: string,
  options: ReadonlyArray<readonly [string, string]>,
): string | undefined {
  const text = normalize(answer)
  if (text.length === 0) return undefined

  const matches = options.filter(([id, label]) => {
    const normalizedLabel = normalize(label)

    // Igual ao rótulo, ou o rótulo inteiro dentro da frase: "quero ver produtos" contém "ver produtos".
    if (normalizedLabel.length > 0 && (text === normalizedLabel || text.includes(normalizedLabel))) return true

    // O cliente falou o id (raro, mas acontece com ids curtos e legíveis).
    if (text === normalize(id)) return true

    /**
     * Todas as palavras que distinguem o rótulo aparecem na resposta, em qualquer ordem.
     *
     * É o que cobre a fala real: "quero repetir o pedido da semana passada" para "🔁 Repetir pedido".
     * Exige TODAS, não qualquer uma — "pedido" sozinho aparece em quase toda frase de mercado e
     * casaria com opções que o cliente não pediu.
     */
    const words = significantWords(label)
    return words.length > 0 && words.every((word) => text.includes(word))
  })

  return matches.length === 1 ? matches[0]![0] : undefined
}
