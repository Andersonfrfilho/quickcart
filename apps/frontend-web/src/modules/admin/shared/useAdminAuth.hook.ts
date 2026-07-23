import { useEffect, useState } from 'react'
import { useRouter } from '@/app/router'
import { ADMIN_TOKEN_STORAGE_KEY } from '@/modules/admin/shared/adminAuth.constant'

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
}

export function useRequireAdmin(): string | null {
  const { navigate } = useRouter()
  const [token] = useState(getAdminToken)

  useEffect(() => {
    if (!token) navigate('/admin')
  }, [token, navigate])

  return token
}
