import { Badge, Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
import { DEMAND_WINDOWS, useAdminDemandsPage } from '@/modules/admin/hooks/useAdminDemandsPage.hook'

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR')
}

export function AdminDemandsPage() {
  const {
    token,
    demands,
    meta,
    isLoading,
    windowDays,
    setWindowDays,
    aliasTargetTerm,
    openAliasPicker,
    closeAliasPicker,
    productSearch,
    setProductSearch,
    matchingProducts,
    addAlias,
    isSavingAlias,
    feedback,
  } = useAdminDemandsPage()

  if (!token) return null

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demanda não atendida</h1>
        <p className="text-muted-foreground">
          O que os clientes pediram e a loja não tinha. Nenhuma outra tela mostra isso — a venda não
          aconteceu, então não está no histórico de pedidos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEMAND_WINDOWS.map((window) => (
          <Button
            key={window.days}
            variant={windowDays === window.days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWindowDays(window.days)}
          >
            {window.label}
          </Button>
        ))}
      </div>

      {feedback && <p className="rounded-md border bg-card p-3 text-sm">{feedback}</p>}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Como falaram</TableHead>
              {/* Clientes antes de pedidos, de propósito: é o número que decide comprar estoque. */}
              <TableHead>Clientes</TableHead>
              <TableHead>Pedidos</TableHead>
              <TableHead>Última vez</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6}>Carregando…</TableCell>
              </TableRow>
            )}

            {!isLoading && demands.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  Nenhum pedido sem resposta nesta janela — o catálogo está cobrindo o que os clientes
                  pedem.
                </TableCell>
              </TableRow>
            )}

            {demands.map((demand) => (
              <TableRow key={demand.term}>
                <TableCell className="font-medium">{demand.term}</TableCell>
                <TableCell className="text-muted-foreground">
                  {/* O termo cru revela a palavra que o casador não reconhece — inclusive erro de
                      transcrição, que também é informação: foi assim que o cliente falou. */}
                  “{demand.lastRawTerm}”
                </TableCell>
                <TableCell>
                  <Badge variant={demand.customerCount > 1 ? 'default' : 'outline'}>{demand.customerCount}</Badge>
                </TableCell>
                <TableCell>{demand.requestCount}</TableCell>
                <TableCell>{formatDate(demand.lastRequestedAt)}</TableCell>
                <TableCell>
                  {aliasTargetTerm === demand.term ? (
                    <Button variant="ghost" size="sm" onClick={closeAliasPicker}>
                      Cancelar
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => openAliasPicker(demand)}>
                      Já vendo isso
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {aliasTargetTerm && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-semibold">Apontar “{aliasTargetTerm}” para um produto</h2>
            <p className="text-sm text-muted-foreground">
              O termo entra como apelido do produto, e o bot passa a reconhecer essa fala. Vale para o
              próximo cliente, não para quem já pediu.
            </p>
          </div>

          <Input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Buscar produto por nome ou marca…"
          />

          <div className="space-y-2">
            {matchingProducts.length === 0 && productSearch.trim().length > 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum produto com esse nome. Se a loja realmente não vende, o caminho é cadastrar o
                produto em Produtos.
              </p>
            )}

            {matchingProducts.map((product) => (
              <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.brand ?? 'sem marca'}
                    {product.aliases.length > 0 && ` · apelidos: ${product.aliases.join(', ')}`}
                  </p>
                </div>
                <Button size="sm" disabled={isSavingAlias} onClick={() => void addAlias(product, aliasTargetTerm)}>
                  {isSavingAlias ? 'Salvando…' : 'Usar como apelido'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {meta && (
        <p className="text-sm text-muted-foreground">
          {/* A janela precisa estar na tela: "3 pedidos" sem período não informa nada. */}
          Contagem dos últimos {meta.windowDays} dias, desde {formatDate(meta.since)}.
        </p>
      )}
    </div>
  )
}
