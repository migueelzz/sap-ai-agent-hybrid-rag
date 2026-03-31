import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { UserMessage } from './user-message'
import { AssistantMessage } from './assistant-message'
import type { ChatMessage } from '@/lib/types'

const NEAR_BOTTOM_PX = 120

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming?: boolean
  onRetry?: () => void
  thinkingEnabled?: boolean
  onExtractDocument?: (content: string) => Promise<string>
  onSendNextStep?: (skillName: string) => void
}

export function MessageList({ messages, isStreaming, onRetry, thinkingEnabled = true, onExtractDocument, onSendNextStep }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const isNearBottom = () => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  const scrollToBottom = (smooth = false) => {
    if (smooth) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      const el = containerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }

  const handleScroll = () => {
    // Throttle to one update per animation frame — prevents re-render storm during scroll
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const near = isNearBottom()
      userScrolledRef.current = !near
      // Only trigger re-render when visibility actually changes
      setShowScrollBtn(prev => (prev === !near ? prev : !near))
    })
  }

  // Auto-scroll when messages update — instant (no smooth) to avoid jank during streaming
  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom(false)
    }
  }, [messages])

  const handleScrollBtnClick = () => {
    userScrolledRef.current = false
    setShowScrollBtn(false)
    scrollToBottom(true)
  }

  // Accumulated document: conteúdo de todas as mensagens is_document não-streaming
  const documentContents = messages
    .filter((m) => m.role === 'assistant' && m.isDocument && !m.isStreaming && m.content)
    .map((m) => m.content)

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
          {messages.map((msg, idx) =>
            msg.role === 'human' ? (
              <UserMessage key={msg.id} content={msg.content} attachments={msg.attachments} />
            ) : (
              <AssistantMessage
                key={msg.id}
                message={msg}
                onRetry={idx === messages.length - 1 ? onRetry : undefined}
                thinkingEnabled={thinkingEnabled}
                onExtractDocument={onExtractDocument}
                onSendNextStep={onSendNextStep}
                accumulatedDocument={
                  msg.isDocument && !msg.isStreaming && !msg.nextSkill && documentContents.length > 1
                    ? documentContents.join('\n\n---\n\n')
                    : undefined
                }
              />
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <button
          onClick={handleScrollBtnClick}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground shadow-md hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <ArrowDown className="size-3.5" />
          {isStreaming ? 'Retomar scroll automático' : 'Ir para o final'}
        </button>
      )}
    </div>
  )
}
