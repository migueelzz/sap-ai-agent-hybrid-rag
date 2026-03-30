import { useState, useEffect, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Zap, Trash2, Upload, ToggleLeft, ToggleRight } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { getSkills, uploadSkill, deleteSkill, toggleSkill } from '@/lib/api'
import type { SkillMeta } from '@/lib/types'
import { cn } from '@/lib/utils'

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSkills()
      .then(setSkills)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['md', 'txt'].includes(ext ?? '')) {
      setError('Apenas arquivos .md ou .txt são aceitos.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const skill = await uploadSkill(file)
      setSkills((prev) => {
        const idx = prev.findIndex((s) => s.name === skill.name)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = skill
          return next
        }
        return [skill, ...prev]
      })
    } catch {
      setError('Erro ao fazer upload da skill.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSkill(id)
      setSkills((prev) => prev.filter((s) => s.id !== id))
    } catch {
      setError('Erro ao remover skill.')
    }
  }

  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleSkill(id)
      setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)))
    } catch {
      setError('Erro ao alterar skill.')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 size-5 shrink-0 text-sidebar-primary" />
          <div>
            <h1 className="text-lg font-semibold">Skills</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Comportamentos especializados para o agente. Use{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">/nome-da-skill</code> no chat
              para ativar manualmente, ou deixe o agente detectar automaticamente.
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all',
            isDragging
              ? 'border-sidebar-primary/60 bg-sidebar-primary/5'
              : 'border-border/50 hover:border-border hover:bg-muted/20',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="flex flex-col items-center gap-2">
            <Upload
              className={cn(
                'size-8',
                isDragging ? 'text-sidebar-primary' : 'text-muted-foreground/40',
              )}
            />
            {uploading ? (
              <p className="text-sm text-muted-foreground">Enviando…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  {isDragging ? 'Solte o arquivo aqui' : 'Arraste ou clique para fazer upload'}
                </p>
                <p className="text-xs text-muted-foreground/50">
                  Arquivos .md ou .txt com frontmatter YAML (name + description)
                </p>
              </>
            )}
          </div>
        </div>

        {/* Skills list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-4">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16 rounded" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma skill cadastrada. Faça upload de um arquivo .md para começar.
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className={cn(
                  'group flex items-start gap-3 rounded-xl border p-4 transition-all',
                  skill.is_active
                    ? 'border-border bg-card'
                    : 'border-border/40 bg-muted/10 opacity-60',
                )}
              >
                <Zap
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    skill.is_active ? 'text-sidebar-primary' : 'text-muted-foreground/40',
                  )}
                />

                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{skill.title}</span>
                    <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      /{skill.name}
                    </code>
                    {!skill.is_active && (
                      <span className="shrink-0 text-[10px] text-muted-foreground/50">inativa</span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => void handleToggle(skill.id)}
                    title={skill.is_active ? 'Desativar' : 'Ativar'}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {skill.is_active ? (
                      <ToggleRight className="size-4 text-sidebar-primary" />
                    ) : (
                      <ToggleLeft className="size-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setPendingDeleteSkill(skill.id)}
                    title="Remover skill"
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={pendingDeleteSkill !== null} onOpenChange={(open) => !open && setPendingDeleteSkill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover skill?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é irreversível. A skill será removida permanentemente e não poderá ser usada no chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteSkill !== null) void handleDelete(pendingDeleteSkill)
                setPendingDeleteSkill(null)
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
