import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Trash2, Search, SquarePen } from 'lucide-react'
import { useSessions } from '@/hooks/use-sessions'
import { formatRelativeDate } from '@/lib/sessions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function ChatsPage() {
  const navigate = useNavigate()
  const { sessions, deleteSession } = useSessions()
  const [query, setQuery] = useState('')

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase()),
  )

  // Agrupar por data relativa
  const grouped = filtered.reduce<Record<string, typeof sessions>>((acc, s) => {
    const label = formatRelativeDate(s.createdAt)
    ;(acc[label] ??= []).push(s)
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-base font-semibold text-foreground">Conversas</h1>
        <Button size="sm" variant="outline" onClick={() => navigate('/')} className="gap-1.5 text-xs">
          <SquarePen className="size-3.5" />
          Novo chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversas…"
            className="h-8 pl-9 text-sm bg-muted/30 border-border/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="size-8 mb-3 opacity-30" />
            <p className="text-sm">
              {query ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}
            </p>
          </div>
        )}

        {Object.entries(grouped).map(([label, items]) => (
          <div key={label} className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
              {label}
            </p>
            <Separator className="mb-2 opacity-30" />

            <div className="space-y-0.5">
              {items.map((s) => (
                <div
                  key={s.id}
                  className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors"
                  onClick={() => navigate(`/chat/${s.id}`)}
                >
                  <MessageSquare className="size-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="flex-1 truncate text-sm text-foreground/80 group-hover:text-foreground">
                    {s.title}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteSession(s.id)
                    }}
                    title="Remover"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
