import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ThinkingPanel } from './thinking-panel'
import { SourcesPanel } from './sources-panel'
import type { ChatMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AssistantMessageProps {
  message: ChatMessage
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const { content, toolCalls = [], isStreaming = false } = message
  const isEmpty = !content && toolCalls.length > 0 && isStreaming

  return (
    <div className="flex flex-col gap-0 max-w-[85%]">
      <ThinkingPanel toolCalls={toolCalls} isStreaming={isStreaming} />
      <SourcesPanel toolCalls={toolCalls} />

      {(content || isEmpty) && (
        <div className={cn('prose-chat text-sm', isStreaming && !content && 'hidden')}>
          <div className={cn(isStreaming && content && 'streaming-cursor')}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className ?? '')
                  const isInline = !match
                  return isInline ? (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.82rem' }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {isStreaming && !content && toolCalls.length > 0 && (
        <div className="h-4 w-4 streaming-cursor" />
      )}
    </div>
  )
}
