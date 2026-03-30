import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Search, SquarePen, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessions } from '@/hooks/use-sessions'
import { formatRelativeDate } from '@/lib/sessions'

function ChatsSkeleton() {
  return (
    <div className="space-y-4">
      {['Hoje', 'Esta semana'].map((group) => (
        <div key={group}>
          <Skeleton className="h-3 w-16 mb-2" />
          <Separator className="mb-2 opacity-30" />
          <div className="space-y-0.5">
            {Array.from({ length: group === 'Hoje' ? 3 : 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-3.5 shrink-0 rounded" />
                <Skeleton className="size-3.5 shrink-0 rounded" />
                <Skeleton className={`h-4 flex-1 ${i % 2 === 0 ? 'max-w-52' : 'max-w-36'}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChatsPage() {
  const navigate = useNavigate()
  const { sessions, deleteSession, deleteSessions } = useSessions()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setLoading(false) }, [])
  useEffect(() => { setSelectedIds(new Set()) }, [query])

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase()),
  )

  const grouped = filtered.reduce<Record<string, typeof sessions>>((acc, s) => {
    const label = formatRelativeDate(s.createdAt)
    ;(acc[label] ??= []).push(s)
    return acc
  }, {})

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    if (pendingDelete.length === 1) {
      void deleteSession(pendingDelete[0])
    } else {
      void deleteSessions(pendingDelete)
    }
    setSelectedIds(new Set())
    setPendingDelete(null)
  }

  const pendingCount = pendingDelete?.length ?? 0

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border py-4">
          <h1 className="text-base font-semibold text-foreground">Conversas</h1>
          <Button size="sm" variant="outline" onClick={() => navigate('/')} className="gap-1.5 text-xs">
            <SquarePen className="size-3.5" />
            Novo chat
          </Button>
        </div>

        {/* Search */}
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversas…"
              className="h-10 pl-9 text-sm bg-muted/30 border-border/50"
            />
          </div>
        </div>

        {loading ? (
          <ChatsSkeleton />
        ) : (
          <>
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setPendingDelete([...selectedIds])}
                  >
                    <Trash2 className="size-3.5 mr-1.5" />
                    Remover selecionadas
                  </Button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="flex-1 pb-6">
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
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleSelect(s.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
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
                            setPendingDelete([s.id])
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
          </>
        )}

        {/* Confirmation dialog */}
        <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Remover {pendingCount === 1 ? 'conversa' : `${pendingCount} conversas`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação é irreversível. Todo o histórico, arquivos e dados
                {pendingCount === 1 ? ' da conversa serão removidos' : ' das conversas serão removidos'} permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={confirmDelete}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
