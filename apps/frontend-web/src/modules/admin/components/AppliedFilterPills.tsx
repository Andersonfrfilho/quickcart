import { Button } from '@/components/ui'

export type AppliedFilter = {
  /** Identificador estável da pill — precisa sobreviver a reordenação da lista. */
  readonly key: string
  /** O que está filtrando, em uma linha: "Situação: Aguardando", "Busca: sofia". */
  readonly label: string
  readonly onRemove: () => void
}

export type AppliedFilterPillsProps = {
  readonly filters: readonly AppliedFilter[]
  readonly onClearAll: () => void
}

/**
 * O que está filtrando agora, em pills removíveis.
 *
 * Os botões de filtro mostram o próprio estado, mas busca e ordenação não têm botão: quem digitava
 * "sofia" via a lista encurtar sem nada na tela dizendo por quê — e a saída era limpar tudo ou apagar o
 * campo às cegas. A pill mostra o filtro invisível e devolve o controle de tirar SÓ ele.
 *
 * Removível uma por uma de propósito: "limpar tudo" obriga a refazer o resto, e num relatório que se
 * lê ajustando um critério por vez isso custa a comparação que a pessoa estava fazendo.
 */
export function AppliedFilterPills({ filters, onClearAll }: AppliedFilterPillsProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={filter.onRemove}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm hover:bg-accent"
          aria-label={`Remover filtro ${filter.label}`}
        >
          <span>{filter.label}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            ✕
          </span>
        </button>
      ))}

      {/* "Limpar tudo" só aparece quando há mais de uma pill: com uma só, a própria pill já é o botão. */}
      {filters.length > 1 && (
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          Limpar tudo
        </Button>
      )}
    </div>
  )
}
