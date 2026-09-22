/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { describe, expect, it } from 'bun:test'

import { FlowDriver } from '@/modules/conversation/application/FlowDriver'
import { isExitWord } from '@/modules/conversation/application/isExitWord'

describe('isExitWord', () => {
  it('reconhece sair e cancelar ignorando caixa e espaços', () => {
    expect(isExitWord('sair')).toBe(true)
    expect(isExitWord('  Cancelar ')).toBe(true)
  })

  it('não confunde frase que só contém a palavra', () => {
    expect(isExitWord('quero sair para comprar')).toBe(false)
    expect(isExitWord('arroz')).toBe(false)
  })
})

describe('FlowDriver — sair no meio do fluxo', () => {
  it('solta a posição no fluxo e devolve a mensagem para o handler global', async () => {
    const releasedPositions: unknown[][] = []
    const loadedFlows: string[] = []
    const driver = new FlowDriver({
      sessionRepository: {
        setFlowPosition: async (...args: unknown[]) => {
          releasedPositions.push(args)
        },
      },
      loadFlow: async (key: string) => {
        loadedFlows.push(key)
        return undefined
      },
    } as unknown as ConstructorParameters<typeof FlowDriver>[0])

    const result = await driver.handleInbound({
      session: { whatsappNumber: '5511999990000', flowKey: 'main', currentNodeId: 'menu', context: {} },
      message: { kind: 'text', from: '5511999990000', waMessageId: 'wamid-1', body: 'Sair' },
    } as unknown as Parameters<FlowDriver['handleInbound']>[0])

    expect(result).toEqual({ handled: false })
    expect(releasedPositions).toHaveLength(1)
    expect(releasedPositions[0]?.slice(1)).toEqual(['5511999990000', null, null])
    expect(loadedFlows).toEqual([])
  })
})
