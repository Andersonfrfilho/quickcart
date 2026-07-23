import { useCallback } from 'react'
import { useRouter } from '@/app/router'

export type QueryParamUpdates = Record<string, string | undefined>

type UseUrlQueryStateResult = {
  searchParams: URLSearchParams
  setQueryParams: (updates: QueryParamUpdates) => void
}

export function useUrlQueryState(): UseUrlQueryStateResult {
  const { currentPath, searchParams, navigate } = useRouter()

  const setQueryParams = useCallback(
    (updates: QueryParamUpdates) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') next.delete(key)
        else next.set(key, value)
      }
      const queryString = next.toString()
      navigate(queryString ? `${currentPath}?${queryString}` : currentPath)
    },
    [currentPath, searchParams, navigate],
  )

  return { searchParams, setQueryParams }
}
