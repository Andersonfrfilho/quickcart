/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Templates do WhatsApp: lista o que já foi enviado à Meta (com status de aprovação) e permite
 * submeter um novo. Sem cache local — a Meta decide o status, então cada `list` busca na hora.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, SendHorizonal } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { ApiRequestError } from '@/modules/conversations/shared/ApiRequestError'
import { templatesApi, type CreateTemplateInput } from '@/modules/conversations/shared/templatesApi'

const TEMPLATES_QUERY_KEY = ['whatsapp-templates']

const EMPTY_FORM: CreateTemplateInput = {
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  headerType: 'NONE',
  headerText: '',
  bodyText: '',
  footerText: '',
}

export function AdminTemplatesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateTemplateInput>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const { data: templates, isLoading, isError, refetch } = useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: templatesApi.list,
    staleTime: 2 * 60 * 1000,
  })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setResult(null)
    try {
      const { headerText, footerText, ...rest } = form
      const created = await templatesApi.create({
        ...rest,
        ...(headerText ? { headerText } : {}),
        ...(footerText ? { footerText } : {}),
      })
      setResult({ ok: true, message: `Template enviado para aprovação (status: ${created.status})` })
      setForm(EMPTY_FORM)
      queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY })
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : 'Falha ao criar template'
      setResult({ ok: false, message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">Templates aprovados pela Meta para envio fora da janela de 24h</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Templates existentes</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {isError && (
            <p className="text-sm text-destructive">Não foi possível carregar os templates.</p>
          )}
          {!isError && !isLoading && (templates?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>
          )}
          {templates?.map((template) => (
            <div
              key={`${template.name}-${template.language}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{template.displayName}</p>
                <p className="text-xs text-muted-foreground">{template.category} · {template.language}</p>
              </div>
              <span className="text-xs font-medium">{template.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novo template</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                placeholder="confirmacao_pedido"
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value as CreateTemplateInput['category'] })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="UTILITY">UTILITY (Transacional)</option>
                  <option value="MARKETING">MARKETING (Promocional)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Idioma</label>
                <select
                  value={form.language}
                  onChange={(event) => setForm({ ...form, language: event.target.value })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="pt_BR">Português (BR)</option>
                  <option value="en_US">Inglês (US)</option>
                  <option value="es_ES">Espanhol (ES)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Cabeçalho</label>
              <div className="mt-1 flex gap-2">
                <select
                  value={form.headerType}
                  onChange={(event) => setForm({ ...form, headerType: event.target.value as CreateTemplateInput['headerType'] })}
                  className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="NONE">Sem cabeçalho</option>
                  <option value="TEXT">Texto</option>
                </select>
                {form.headerType === 'TEXT' && (
                  <Input
                    value={form.headerText}
                    onChange={(event) => setForm({ ...form, headerText: event.target.value })}
                    placeholder="Título do template"
                    maxLength={60}
                    className="flex-1"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Corpo</label>
              <p className="text-xs text-muted-foreground mb-1">Use {'{{1}}'}, {'{{2}}'}... para variáveis</p>
              <textarea
                value={form.bodyText}
                onChange={(event) => setForm({ ...form, bodyText: event.target.value })}
                placeholder="Olá {{1}}, seu pedido foi confirmado."
                rows={4}
                required
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Rodapé</label>
              <Input
                value={form.footerText}
                onChange={(event) => setForm({ ...form, footerText: event.target.value })}
                placeholder="Opcional"
                maxLength={60}
                className="mt-1"
              />
            </div>

            {result && (
              <p className={`text-sm ${result.ok ? 'text-emerald-600' : 'text-destructive'}`}>{result.message}</p>
            )}

            <Button type="submit" disabled={submitting || !form.name || !form.bodyText}>
              <SendHorizonal size={14} />
              {submitting ? 'Enviando...' : 'Enviar para aprovação'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
