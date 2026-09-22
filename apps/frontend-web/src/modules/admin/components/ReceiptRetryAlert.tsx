/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Caminho visível para reenviar o recibo quando a fila caiu depois de o status ter sido salvo.
 */

import { Button } from '@/components/ui'

export type ReceiptRetryAlertProps = {
  readonly message: string
  readonly isRetrying: boolean
  readonly onRetry: () => void
}

export function ReceiptRetryAlert({ message, isRetrying, onRetry }: ReceiptRetryAlertProps) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <p className="flex-1">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        Reenviar para emissão
      </Button>
    </div>
  )
}
