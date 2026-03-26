import { FileText, ExternalLink } from 'lucide-react'
import type { ToolCall } from '@/lib/types'

interface Source {
  type: 'doc' | 'web'
  label: string
  url?: string
}

function extractSources(toolCalls: ToolCall[]): Source[] {
  const sources: Source[] = []
  const seenDocs = new Set<string>()
  const seenUrls = new Set<string>()

  for (const tc of toolCalls) {
    if (!tc.output) continue

    if (tc.name === 'rag_search') {
      // Extrai títulos de seções marcadas como "### Título"
      const headings = tc.output.matchAll(/^#{1,3}\s+(.+)$/gm)
      for (const m of headings) {
        const title = m[1].trim()
        if (!seenDocs.has(title) && !title.startsWith('Consulta')) {
          seenDocs.add(title)
          sources.push({ type: 'doc', label: title })
        }
      }
    }

    if (tc.name === 'web_search') {
      // Extrai URLs
      const urls = tc.output.matchAll(/https?:\/\/[^\s\])"]+/g)
      for (const m of urls) {
        const url = m[0].replace(/[.,;!?]$/, '')
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          try {
            const host = new URL(url).hostname.replace(/^www\./, '')
            sources.push({ type: 'web', label: host, url })
          } catch {
            sources.push({ type: 'web', label: url, url })
          }
        }
      }
    }
  }

  return sources
}

interface SourcesPanelProps {
  toolCalls: ToolCall[]
}

export function SourcesPanel({ toolCalls }: SourcesPanelProps) {
  const sources = extractSources(toolCalls)
  if (sources.length === 0) return null

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {sources.map((src, i) =>
        src.type === 'doc' ? (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground"
          >
            <FileText className="size-3 shrink-0 text-sidebar-primary/70" />
            <span className="max-w-[180px] truncate">{src.label}</span>
          </div>
        ) : (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <ExternalLink className="size-3 shrink-0 text-sidebar-primary/70" />
            <span className="max-w-[180px] truncate">{src.label}</span>
          </a>
        ),
      )}
    </div>
  )
}
