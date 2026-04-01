import { useState, useEffect } from 'react'
import { Brain, ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ToolBadge } from './tool-badge'
import type { ToolCall } from '@/lib/types'

interface ThinkingPanelProps {
  toolCalls: ToolCall[]
  thinkingContent?: string
  thinkingElapsedMs?: number
  isStreaming: boolean
  visible?: boolean
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ThinkingPanel({ toolCalls, thinkingContent, thinkingElapsedMs, isStreaming, visible = true }: ThinkingPanelProps) {
  const [open, setOpen] = useState(false)

  const hasThinking = !!thinkingContent
  const hasTools = toolCalls.length > 0
  const hasContent = hasThinking || hasTools

  // Abre automaticamente durante o streaming; fecha ao terminar (a não ser que o usuário tenha aberto manualmente)
  useEffect(() => {
    if (isStreaming && hasContent) setOpen(true)
    if (!isStreaming) setOpen(false)
  }, [isStreaming, hasContent])

  if (!visible || !hasContent) return null

  const runningCount = toolCalls.filter((t) => t.status === 'running').length
  const doneCount = toolCalls.filter((t) => t.status === 'done').length

  // Label do header
  const isThinking = isStreaming && hasThinking && !thinkingElapsedMs
  const headerLabel = isThinking
    ? 'Pensando…'
    : thinkingElapsedMs
      ? `Pensou por ${formatElapsed(thinkingElapsedMs)}`
      : hasThinking
        ? 'Pensamento do agente'
        : 'Processando'

  // Resumo das ações (apenas quando há tools)
  const toolSummary = hasTools
    ? runningCount > 0
      ? `${runningCount} ação em andamento`
      : `${doneCount} ${doneCount === 1 ? 'ação' : 'ações'}`
    : null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Brain
          className={
            isThinking
              ? 'size-3.5 text-sidebar-primary animate-pulse'
              : 'size-3.5 text-sidebar-primary/60 group-hover:text-sidebar-primary transition-colors'
          }
        />
        <span className="font-medium">{headerLabel}</span>
        {toolSummary && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/55">{toolSummary}</span>
          </>
        )}
        {open ? (
          <ChevronDown className="size-3 ml-0.5" />
        ) : (
          <ChevronRight className="size-3 ml-0.5" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="rounded-xl border border-border/30 bg-muted/5 overflow-hidden divide-y divide-border/20">

          {/* Seção: texto de raciocínio do modelo */}
          {hasThinking && (
            <div className="px-3 py-3 space-y-2">
              <p className="text-[11px] text-muted-foreground/70 whitespace-pre-wrap leading-relaxed font-mono">
                {thinkingContent}
                {isThinking && (
                  <span className="inline-block w-1.5 h-3 ml-0.5 bg-sidebar-primary/60 animate-pulse rounded-sm" />
                )}
              </p>
            </div>
          )}

          {/* Seção: ferramentas utilizadas */}
          {hasTools && (
            <div className="px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Wrench className="size-3 text-muted-foreground/40" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
                  Ações
                  {runningCount > 0 && (
                    <span className="ml-1.5 text-sidebar-primary/60 font-normal normal-case">
                      em andamento…
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                {toolCalls.map((tc) => (
                  <ToolBadge key={tc.id} tool={tc} />
                ))}
              </div>
            </div>
          )}

        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
