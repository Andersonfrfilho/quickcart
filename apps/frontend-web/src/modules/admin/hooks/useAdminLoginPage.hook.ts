import { useState } from 'react'
import { useRouter } from '@/app/router'
import { setAdminToken } from '@/modules/admin/shared/useAdminAuth.hook'

export function useAdminLoginPage() {
  const { navigate } = useRouter()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  function handleTokenChange(value: string) {
    setToken(value)
    setError('')
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) {
      setError('Token obrigatório')
      return
    }
    setAdminToken(token.trim())
    navigate('/admin/products')
  }

  return { token, error, handleTokenChange, handleLogin }
}
