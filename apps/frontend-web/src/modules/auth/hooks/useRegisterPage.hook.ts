/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * O `user-ui` traz login, recuperação e redefinição, mas não auto-cadastro — o `user-module` não
 * publica essa rota, porque papel é decisão do host. O cadastro do cliente final é do produto, e a
 * rota que ele chama é `POST /v1/store/register`.
 */

import React from 'react'

import { useRouter } from '@/app/router'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const SIGN_IN_PATH = '/entrar'
const PHONE_MAX_DIGITS = 13
const MINIMUM_PASSWORD_LENGTH = 8

const ERROR_BY_CODE: Readonly<Record<string, string>> = {
  CUSTOMER_PHONE_ALREADY_REGISTERED: 'Este telefone já está ligado a outra conta.',
  USER_EMAIL_ALREADY_EXISTS: 'Já existe uma conta com este e-mail.',
  USER_WEAK_PASSWORD: 'Escolha uma senha mais forte.',
}

/** Só dígitos vão para a api: o telefone é a chave do cliente, e "(11) 9…" e "119…" seriam dois. */
function toDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS)
}

export function useRegisterPage() {
  const { navigate } = useRouter()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  function handlePhoneChange(value: string) {
    setPhone(toDigits(value))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(undefined)

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setError(`A senha precisa de pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/v1/store/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null
        const code = payload?.error?.code
        setError((code && ERROR_BY_CODE[code]) ?? 'Não foi possível criar a conta.')
        return
      }

      // O cadastro não loga sozinho: a pessoa acabou de escolher uma senha e a digita uma vez mais.
      navigate(SIGN_IN_PATH)
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    name,
    email,
    phone,
    password,
    error,
    isSubmitting,
    setName,
    setEmail,
    setPassword,
    handlePhoneChange,
    handleSubmit,
  }
}
