import React from 'react'
import {
  Badge,
  Button,
  Input,
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { FilterRow } from '@/modules/admin/components/FilterRow'
import { DEMAND_WINDOWS, useAdminDemandsPage } from '@/modules/admin/hooks/useAdminDemandsPage.hook'
import {
  UNMATCHED_DEMAND_SOURCE,
  type UnmatchedDemandSortableField,
  type UnmatchedDemandSource,
} from '@/shared/api/api.types'

/**
 * O rótulo diz a DECISÃO, não o nome interno da origem.
 *
 * "list" e "resolution_skipped" só significam algo para quem leu o código do bot; o lojista lê a linha
 * para saber se cadastra produto novo ou se repõe o que já vende.
 */
const SOURCE_LABELS: Record<UnmatchedDemandSource, string> = {
  [UNMATCHED_DEMAND_SOURCE.LIST]: 'Não temos no catálogo',
  [UNMATCHED_DEMAND_SOURCE.RESOLUTION_SKIPPED]: 'Não era o que ele queria',
  [UNMATCHED_DEMAND_SOURCE.OUT_OF_STOCK]: 'Acabou no estoque',
}

/** Estoque em vermelho: é a única origem em que a loja perdeu venda de algo que ela já vende. */
const SOURCE_VARIANTS: Record<UnmatchedDemandSource, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  [UNMATCHED_DEMAND_SOURCE.LIST]: 'outline',
  [UNMATCHED_DEMAND_SOURCE.RESOLUTION_SKIPPED]: 'secondary',
  [UNMATCHED_DEMAND_SOURCE.OUT_OF_STOCK]: 'destructive',
}

const SOURCE_FILTER_OPTIONS = Object.entries(SOURCE_LABELS) as (readonly [string, string])[]

const COLUMN_COUNT = 7

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
    sourceFilter,
    toggleSourceFilter,
    search,
    setSearch,
    sortBy,
    sortDirection,
    handleSort,
    hasFiltersApplied,
    clearFilters,
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

  // Campo local para digitar sem refazer a consulta a cada letra; a URL recebe no enter ou ao sair.
  const [searchDraft, setSearchDraft] = React.useState(search)
  React.useEffect(() => setSearchDraft(search), [search])

  if (!token) return null

  function sortHeaderProps(field: UnmatchedDemandSortableField) {
    return { active: sortBy === field, direction: sortDirection, onSort: () => handleSort(field) }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demanda não atendida</h1>
        <p className="text-muted-foreground">
          O que os clientes pediram e a loja não tinha. Nenhuma outra tela mostra isso — a venda não
          aconteceu, então não está no histórico de pedidos.
        </p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setSearch(searchDraft)
        }}
      >
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onBlur={() => setSearch(searchDraft)}
          placeholder="Buscar termo pedido…"
          className="max-w-xs"
          aria-label="Buscar termo pedido"
        />
        <Button type="submit" variant="secondary" size="sm">
          Buscar
        </Button>
      </form>

      <div className="space-y-2">
        <FilterRow
          label="Origem"
          options={SOURCE_FILTER_OPTIONS}
          selected={sourceFilter}
          onToggle={toggleSourceFilter}
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* A janela fica na mesma barra dos filtros porque é um filtro: recorta o mesmo relatório. */}
          <span className="w-24 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
          {DEMAND_WINDOWS.map((window) => (
            <Button
              key={window.days}
              variant={windowDays === window.days ? 'default' : 'outline'}
              size="sm"
              aria-pressed={windowDays === window.days}
              onClick={() => setWindowDays(window.days)}
            >
              {window.label}
            </Button>
          ))}
        </div>

        {/* Só quando há filtro ou ordenação aplicados: botão morto ensina a ignorar a barra inteira. */}
        {hasFiltersApplied && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar filtros e ordenação
          </Button>
        )}
      </div>

      {feedback && <p className="rounded-md border bg-card p-3 text-sm">{feedback}</p>}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="table-zebra">
          <TableHeader>
            <TableRow>
              <SortableTableHead {...sortHeaderProps('term')}>Pedido</SortableTableHead>
              <TableHead>Como falaram</TableHead>
              <TableHead>Origem</TableHead>
              {/* Clientes antes de pedidos, de propósito: é o número que decide comprar estoque. */}
              <SortableTableHead {...sortHeaderProps('customerCount')}>Clientes</SortableTableHead>
              <SortableTableHead {...sortHeaderProps('requestCount')}>Pedidos</SortableTableHead>
              <SortableTableHead {...sortHeaderProps('lastRequestedAt')}>Última vez</SortableTableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>Carregando…</TableCell>
              </TableRow>
            )}

            {!isLoading && demands.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  {hasFiltersApplied
                    ? 'Nenhum pedido sem resposta com esses filtros.'
                    : 'Nenhum pedido sem resposta nesta janela — o catálogo está cobrindo o que os clientes pedem.'}
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
                  {/* Todas as origens do termo, não só a mais recente: "acabou" e "não temos" no mesmo
                      item são duas providências diferentes, e mostrar uma esconderia a outra. */}
                  <div className="flex flex-wrap gap-1">
                    {demand.sources.map((source) => (
                      <Badge key={source} variant={SOURCE_VARIANTS[source] ?? 'outline'}>
                        {SOURCE_LABELS[source] ?? source}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={demand.customerCount > 1 ? 'default' : 'outline'}>{demand.customerCount}</Badge>
                </TableCell>
                <TableCell>{demand.requestCount}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(demand.lastRequestedAt)}</TableCell>
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
