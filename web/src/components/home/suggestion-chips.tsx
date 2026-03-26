import { Button } from '@/components/ui/button'

const SUGGESTIONS = [
  { label: 'Lançamentos FI', prompt: 'Como realizar lançamentos contábeis no módulo FI?' },
  { label: 'Pedidos MM', prompt: 'Como criar um pedido de compra no módulo MM?' },
  { label: 'Faturamento SD', prompt: 'Qual o processo de faturamento no módulo SD?' },
  { label: 'ABAP/CDS', prompt: 'Como criar uma CDS View no SAP S/4HANA?' },
  { label: 'Tabelas SAP', prompt: 'Quais as principais tabelas do módulo FI no SAP?' },
]

interface SuggestionChipsProps {
  onSelect: (prompt: string) => void
}

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {SUGGESTIONS.map((s) => (
        <Button
          key={s.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(s.prompt)}
          className="rounded-full text-xs text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
        >
          {s.label}
        </Button>
      ))}
    </div>
  )
}
