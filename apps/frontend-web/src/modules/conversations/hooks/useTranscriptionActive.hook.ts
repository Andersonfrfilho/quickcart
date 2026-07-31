/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * A transcrição está valendo para esta empresa AGORA?
 *
 * Existe só para a inbox decidir se entrega `transcribeAudio` ao SDK. O contrato do pacote trata o
 * método como opcional por capacidade — ausente, o balão não desenha o botão em vez de oferecer uma
 * ação que estoura no clique. Sem esta consulta, o botão apareceria em toda instalação, inclusive nas
 * que não têm engine configurado, e o clique voltaria 404.
 */

import { useEffect, useState } from 'react'
import { messagesApi } from '@/modules/messages/shared/messagesApi'

/**
 * Começa `false`: enquanto não se sabe, é melhor não oferecer o botão do que piscá-lo e retirá-lo.
 * Falha na consulta também mantém `false` — a configuração não é essencial para a inbox funcionar, e
 * derrubar o atendimento porque a leitura de settings falhou seria desproporcional.
 */
export function useTranscriptionActive(): boolean {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    let isMounted = true

    messagesApi
      .getSettings()
      .then((settings) => {
        if (isMounted) setIsActive(settings.transcriptionActive === true)
      })
      .catch(() => {
        // Silencioso por desenho: ver o comentário do estado inicial.
      })

    return () => {
      isMounted = false
    }
  }, [])

  return isActive
}
