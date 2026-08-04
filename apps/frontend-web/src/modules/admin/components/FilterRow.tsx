import { Button } from '@/components/ui'

type FilterRowProps = {
  label: string
  options: readonly (readonly [string, string])[]
  selected: readonly string[]
  onToggle: (value: string) => void
}

/**
 * Uma linha de filtro com seleção múltipla.
 *
 * Múltipla, e não valor único, porque o trabalho é olhar "aguardando E preparando" ao mesmo tempo —
 * filtro exclusivo obrigaria o operador a escolher qual metade do próprio trabalho enxergar.
 */
export function FilterRow({ label, options, selected, onToggle }: FilterRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {options.map(([value, optionLabel]) => (
        <Button
          key={value}
          variant={selected.includes(value) ? 'default' : 'outline'}
          size="sm"
          aria-pressed={selected.includes(value)}
          onClick={() => onToggle(value)}
        >
          {optionLabel}
        </Button>
      ))}
    </div>
  )
}
