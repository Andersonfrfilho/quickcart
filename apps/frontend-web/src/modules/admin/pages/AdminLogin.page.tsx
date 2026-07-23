import React from 'react'
import { useAdminLoginPage } from '@/modules/admin/hooks/useAdminLoginPage.hook'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'

export function AdminLoginPage() {
  const { token, error, handleTokenChange, handleLogin } = useAdminLoginPage()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-4">
            QC
          </div>
          <CardTitle>QuickCart Admin</CardTitle>
          <CardDescription>Entre com seu token de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="token">Token de acesso</label>
              <Input
                id="token"
                type="password"
                placeholder="ADMIN_API_TOKEN"
                value={token}
                onChange={(e) => handleTokenChange(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
