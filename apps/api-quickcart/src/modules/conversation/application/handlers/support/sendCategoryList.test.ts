/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O bot NÃO pode emudecer. Foi o defeito que apareceu no staging: quem clicava em "ver produtos"
 * pelo grafo de fluxo lia "só um instante" e não recebia mais nada, porque a ação prometia a lista
 * "na próxima mensagem" e ninguém a enviava.
 */

import { describe, expect, it } from 'bun:test'

import type { Category } from '@/infra/database/schema'
import { MESSAGES } from '@/modules/conversation/shared/Messages.constant'

import { sendCategoryList } from './sendCategoryList'

const PHONE = '5511988887777'

function buildCategory(name: string): Category {
  return { id: `id-${name}`, name, emoji: '🛒', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() } as Category
}

function buildSender() {
  const texts: string[] = []
  const lists: { body: string; rows: number }[] = []
  return {
    texts,
    lists,
    async sendText(_phone: string, text: string) {
      texts.push(text)
    },
    async sendInteractiveList(
      _phone: string,
      body: string,
      _label: string,
      sections: readonly { readonly rows: readonly unknown[] }[],
    ) {
      lists.push({ body, rows: sections[0]?.rows.length ?? 0 })
    },
  }
}

describe('sendCategoryList', () => {
  it('envia a lista na hora quando há categorias — a promessa e a entrega são o mesmo passo', async () => {
    const sender = buildSender()

    const sent = await sendCategoryList({
      categoryRepository: { async list() { return [buildCategory('Mercearia'), buildCategory('Bebidas')] } },
      whatsAppSender: sender,
      customerPhone: PHONE,
    })

    expect(sent).toBe(true)
    expect(sender.lists).toHaveLength(1)
    expect(sender.lists[0]?.rows).toBe(2)
  })

  it('catálogo vazio AVISA, em vez de deixar a conversa morrer calada', async () => {
    const sender = buildSender()

    const sent = await sendCategoryList({
      categoryRepository: { async list() { return [] } },
      whatsAppSender: sender,
      customerPhone: PHONE,
    })

    expect(sent).toBe(false)
    expect(sender.texts).toEqual([MESSAGES.BROWSE_NO_CATEGORIES])
    expect(sender.lists).toEqual([])
  })

  it('nunca fica em silêncio: sempre sai lista OU aviso, nos dois cenários', async () => {
    for (const categories of [[], [buildCategory('Mercearia')]]) {
      const sender = buildSender()
      await sendCategoryList({
        categoryRepository: { async list() { return categories } },
        whatsAppSender: sender,
        customerPhone: PHONE,
      })

      expect(sender.texts.length + sender.lists.length).toBeGreaterThan(0)
    }
  })
})
