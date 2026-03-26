import { useState, useEffect } from 'react'
import { Brain, ChevronDown, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ToolBadge } from './tool-badge'
import type { ToolCall } from '@/lib/types'

interface ThinkingPanelProps {
  toolCalls: ToolCall[]
  isStreaming: boolean
}

export function ThinkingPanel({ toolCalls, isStreaming }: ThinkingPanelProps) {
  const [open, setOpen] = useState(false)

  // Abre automaticamente durante o streaming
  useEffect(() => {
    if (isStreaming && toolCalls.length > 0) setOpen(true)
  }, [isStreaming, toolCalls.length])

  if (toolCalls.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <Brain className="size-3.5 text-sidebar-primary/70 group-hover:text-sidebar-primary" />
        <span>Raciocínio do agente</span>
        {open ? (
          <ChevronDown className="size-3 transition-transform" />
        ) : (
          <ChevronRight className="size-3 transition-transform" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 flex flex-col gap-1.5">
        {toolCalls.map((tc) => (
          <ToolBadge key={tc.id} tool={tc} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
