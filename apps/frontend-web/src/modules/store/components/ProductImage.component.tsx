import React, { useState } from 'react'
import { cn } from '@/lib/cn'

type ProductImageProps = {
  readonly imageUrl: string | null
  readonly name: string
  readonly fallbackEmoji?: string | null | undefined
  readonly className?: string
}

export function ProductImage({ imageUrl, name, fallbackEmoji, className }: ProductImageProps) {
  const [hasError, setHasError] = useState(false)

  if (imageUrl && !hasError) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        onError={() => setHasError(true)}
        className={cn('aspect-square w-full rounded-md object-cover bg-muted', className)}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        'aspect-square w-full rounded-md bg-muted flex items-center justify-center text-3xl',
        className
      )}
    >
      {fallbackEmoji ?? '🛒'}
    </div>
  )
}
