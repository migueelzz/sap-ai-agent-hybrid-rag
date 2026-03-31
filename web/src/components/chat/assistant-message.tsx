import { useState, useEffect, useRef, Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, RefreshCw, AlertCircle, Loader2, Download, FileCode, FileText, Play, ChevronRight, BookOpen } from 'lucide-react'
import { ThinkingPanel } from './thinking-panel'
import { SourcesPanel } from './sources-panel'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { downloadAsMarkdown, downloadAsPdf } from '@/lib/download'
import type { ChatMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

// Labels legíveis para skills de chains conhecidas
const SKILL_STEP_LABELS: Record<string, string> = {
  'cds-structural-analysis': 'Análise Estrutural',
  'cds-behavior-analysis': 'Análise Comportamental',
  'cds-context-inference': 'Inferência de Contexto',
  'cds-doc-generator': 'Gerar Documento Final',
}

function formatSkillLabel(name: string): string {
  return name
    .split('-')
    .filter((p) => p !== 'cds')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

interface AssistantMessageProps {
  message: ChatMessage
  onRetry?: () => void
  thinkingEnabled?: boolean
  onExtractDocument?: (content: string) => Promise<string>
  onSendNextStep?: (skillName: string) => void
  accumulatedDocument?: string
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function DownloadMenu({
  content,
  isDocument,
  onExtractDocument,
  label,
  icon,
}: {
  content: string
  isDocument?: boolean
  onExtractDocument?: (content: string) => Promise<string>
  label?: string
  icon?: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)

  const handlePdf = async () => {
    setLoading(true)
    try {
      const clean = onExtractDocument ? await onExtractDocument(content) : content
      await downloadAsPdf(clean)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={loading}
          title={label ?? 'Baixar resposta'}
          className="rounded p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : (icon ?? <Download className="size-3.5" />)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom">
        <DropdownMenuItem onClick={() => downloadAsMarkdown(content)}>
          <FileCode className="size-4" /> Baixar como Markdown
        </DropdownMenuItem>
        {isDocument && (
          <DropdownMenuItem onClick={() => void handlePdf()}>
            <FileText className="size-4" /> Baixar como PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className={className ?? 'rounded p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors'}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

export function AssistantMessage({ message, onRetry, thinkingEnabled = true, onExtractDocument, onSendNextStep, accumulatedDocument }: AssistantMessageProps) {
  const { content, toolCalls = [], thinkingContent, isStreaming = false, hasError, elapsedMs, isDocument, nextSkill } = message

  // Timer em tempo real durante o streaming
  const [liveElapsed, setLiveElapsed] = useState(0)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!isStreaming) {
      setLiveElapsed(0)
      return
    }
    startRef.current = Date.now()
    const id = setInterval(() => setLiveElapsed(Date.now() - startRef.current), 100)
    return () => clearInterval(id)
  }, [isStreaming])

  // Estado de loading inicial: streaming mas sem content, thinking ou tools ainda
  const isLoadingInitial = isStreaming && !content && !thinkingContent && toolCalls.length === 0

  return (
    <div className="group flex flex-col gap-0 max-w-[85%]">
      <ThinkingPanel toolCalls={toolCalls} thinkingContent={thinkingContent} isStreaming={isStreaming} visible={thinkingEnabled} />

      {/* Spinner de loading inicial */}
      {isLoadingInitial && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="size-3.5 animate-spin text-sidebar-primary/70" />
          <span>Gerando resposta…</span>
          <span className="text-muted-foreground/40">{formatElapsed(liveElapsed)}</span>
        </div>
      )}

      {/* Erro */}
      {hasError && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>Erro ao gerar resposta.</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-auto flex items-center gap-1 font-medium hover:underline"
            >
              <RefreshCw className="size-3" />
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {content && (
        <div className="prose-chat text-sm">
          <div className={cn(isStreaming && 'streaming-cursor')}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // pre é chamado APENAS para code blocks cercados por ``` (nunca para inline code)
                // Isso resolve a ambiguidade do react-markdown v10 onde `code` recebe tanto
                // inline quanto block, tornando impossível distingui-los sem o prop `inline` (removido em v10)
                pre({ children }) {
                  const codeEl = Children.toArray(children).find(
                    (el): el is ReactElement<{ className?: string; children?: ReactNode }> =>
                      isValidElement(el) && el.type === 'code',
                  )
                  if (!codeEl) return <pre>{children}</pre>
                  const lang = /language-(\w+)/.exec(codeEl.props.className ?? '')
                  const raw = codeEl.props.children
                  const codeStr = (Array.isArray(raw) ? raw.join('') : String(raw ?? '')).replace(/\n$/, '')
                  return (
                    <div className="relative group/code">
                      <CopyButton
                        text={codeStr}
                        className="absolute top-2 right-2 z-10 rounded p-1 opacity-0 group-hover/code:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                      />
                      <SyntaxHighlighter
                        style={oneDark}
                        language={lang?.[1] ?? 'text'}
                        PreTag="div"
                        customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.82rem' }}
                      >
                        {codeStr}
                      </SyntaxHighlighter>
                    </div>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Badges de fontes — abaixo do conteúdo da resposta */}
      <SourcesPanel toolCalls={toolCalls} />

      {/* Footer: timer sempre visível + ações no hover */}
      {(content || hasError || (!isLoadingInitial && isStreaming)) && (
        <div className="mt-1.5 flex items-center gap-1">
          <div className="flex items-center gap-1 transition-opacity">
            {content && !hasError && (
              <>
                <CopyButton text={content} />
                {!isStreaming && <DownloadMenu content={content} isDocument={isDocument} onExtractDocument={onExtractDocument} />}
                {/* Download da análise completa (acumulada) — aparece apenas na última fase */}
                {!isStreaming && accumulatedDocument && (
                  <DownloadMenu
                    content={accumulatedDocument}
                    isDocument={true}
                    onExtractDocument={onExtractDocument}
                    label="Baixar análise completa"
                    icon={<BookOpen className="size-3.5" />}
                  />
                )}
                {!isStreaming && onRetry && (
                  <button
                    onClick={onRetry}
                    title="Tentar novamente"
                    className="rounded p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Timer: sempre visível */}
          {isStreaming && (
            <span className="text-[10px] text-muted-foreground/50 ml-1">
              {formatElapsed(liveElapsed)}
            </span>
          )}
          {!isStreaming && elapsedMs !== undefined && elapsedMs > 0 && (
            <span className="text-[10px] text-muted-foreground/50 ml-1">
              Respondido em {formatElapsed(elapsedMs)}
            </span>
          )}
        </div>
      )}

      {/* Chip de sugestão — próxima etapa da cadeia; visível inclusive após erro (permite retry da fase) */}
      {nextSkill && !isStreaming && (
        <button
          onClick={() => onSendNextStep?.(nextSkill)}
          className="mt-3 flex w-fit items-center gap-2 rounded-lg border border-sidebar-primary/30 bg-sidebar-primary/5 px-3.5 py-2 text-sm text-sidebar-primary transition-colors hover:bg-sidebar-primary/15 hover:border-sidebar-primary/50"
        >
          <Play className="size-3.5 shrink-0 fill-current" />
          <span className="font-medium">
            {SKILL_STEP_LABELS[nextSkill] ?? formatSkillLabel(nextSkill)}
          </span>
          <ChevronRight className="size-3.5 shrink-0 opacity-60" />
        </button>
      )}
    </div>
  )
}
