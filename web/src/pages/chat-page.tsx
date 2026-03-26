import { useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useChat } from '@/hooks/use-chat'
import { MessageList } from '@/components/chat/message-list'
import { ChatInput } from '@/components/chat/chat-input'

interface LocationState {
  firstMessage?: string
}

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const state = location.state as LocationState | null
  const { messages, isStreaming, sendMessage, loadHistory, stopStreaming } = useChat(sessionId ?? '')
  const sentRef = useRef(false)

  useEffect(() => {
    if (!sessionId) return

    if (state?.firstMessage && !sentRef.current) {
      sentRef.current = true
      void sendMessage(state.firstMessage)
    } else if (!state?.firstMessage) {
      void loadHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (!sessionId) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-border px-6 py-3">
        <p className="truncate text-sm text-muted-foreground">
          {messages.find((m) => m.role === 'human')?.content?.slice(0, 60) ?? 'Nova conversa'}
        </p>
      </div>

      <MessageList messages={messages} />

      <ChatInput
        onSend={(text) => void sendMessage(text)}
        onStop={stopStreaming}
        disabled={isStreaming}
        isStreaming={isStreaming}
      />
    </div>
  )
}
