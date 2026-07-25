import React from 'react'
import { Button } from '@/components/ui'

type QuantityStepperProps = {
  readonly quantity: number
  readonly onIncrease: () => void
  readonly onDecrease: () => void
}

export function QuantityStepper({ quantity, onIncrease, onDecrease }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={onDecrease} aria-label="Diminuir quantidade">
        −
      </Button>
      <span className="w-4 text-center text-sm font-medium">{quantity}</span>
      <Button size="sm" onClick={onIncrease} aria-label="Aumentar quantidade">
        +
      </Button>
    </div>
  )
}
