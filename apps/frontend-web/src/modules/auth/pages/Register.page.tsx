import React from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'

import { useRouter } from '@/app/router'
import { useRegisterPage } from '@/modules/auth/hooks/useRegisterPage.hook'

export function RegisterPage() {
  const { navigate } = useRouter()
  const {
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
  } = useRegisterPage()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Para fechar o pedido, precisamos saber quem você é</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="register-name">Nome</label>
              <Input id="register-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="register-email">E-mail</label>
              <Input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="register-phone">Telefone com DDD</label>
              <Input
                id="register-phone"
                inputMode="numeric"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                required
              />
              {/* O telefone é o que reencontra quem já comprou pelo WhatsApp — vale explicar. */}
              <p className="text-xs text-muted-foreground">
                Use o mesmo número do WhatsApp para manter seus pedidos anteriores.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="register-password">Senha</label>
              <Input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Criando…' : 'Criar conta'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/entrar')}>
              Já tenho conta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
