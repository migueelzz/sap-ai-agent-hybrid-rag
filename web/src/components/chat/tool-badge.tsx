import { BookOpen, Globe, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolCall } from '@/lib/types'

const TOOL_META: Record<string, { icon: typeof BookOpen; label: string }> = {
  rag_search: { icon: BookOpen, label: 'Buscando na base de conhecimento SAP' },
  web_search: { icon: Globe, label: 'Pesquisando na web' },
}

interface ToolBadgeProps {
  tool: ToolCall
}

export function ToolBadge({ tool }: ToolBadgeProps) {
  const meta = TOOL_META[tool.name] ?? { icon: BookOpen, label: tool.name }
  const Icon = meta.icon
  const running = tool.status === 'running'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        running
          ? 'border-border bg-muted/30 text-muted-foreground'
          : 'border-border/50 bg-muted/10 text-muted-foreground/70',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="flex-1 truncate">{meta.label}</span>
      {running ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-sidebar-primary" />
      ) : (
        <Check className="size-3.5 shrink-0 text-green-500/70" />
      )}
    </div>
  )
}
