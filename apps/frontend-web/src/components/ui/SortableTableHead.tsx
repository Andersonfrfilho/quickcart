import React from 'react'
import { cn } from '@/lib/cn'
import { TableHead } from './Table'

type SortableTableHeadProps = {
  active: boolean
  direction: 'asc' | 'desc'
  onSort: () => void
  className?: string
  children: React.ReactNode
}

export function SortableTableHead({ active, direction, onSort, className, children }: SortableTableHeadProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSort()
    }
  }

  return (
    <TableHead
      role="button"
      tabIndex={0}
      onClick={onSort}
      onKeyDown={handleKeyDown}
      className={cn('cursor-pointer select-none', className)}
    >
      {children} {active && (direction === 'asc' ? '↑' : '↓')}
    </TableHead>
  )
}
