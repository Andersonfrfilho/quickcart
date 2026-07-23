import { useEffect, useState } from 'react'

export function useDebounce<TValue>(value: TValue, delayInMs: number): TValue {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayInMs)
    return () => clearTimeout(timer)
  }, [value, delayInMs])

  return debouncedValue
}
