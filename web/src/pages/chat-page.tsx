import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useChat } from '@/hooks/use-chat'
import { MessageList } from '@/components/chat/message-list'
import { ChatInput } from '@/components/chat/chat-input'
import { extractDocument, getSkills } from '@/lib/api'
import { getThinkingEnabled, setThinkingEnabled, getWebSearchEnabled, setWebSearchEnabled } from '@/lib/prefs'
import type { SkillMeta } from '@/lib/types'

interface LocationState {
  firstMessage?: string
  pendingFiles?: File[]
  skillNames?: string[]
  webSearchEnabled?: boolean
}

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const state = location.state as LocationState | null
  const {
    messages,
    isStreaming,
    pendingFiles,
    sendMessage,
    sendNextStep,
    loadHistory,
    loadAttachments,
    stopStreaming,
    retryLast,
    addPendingFile,
    removePendingFile,
  } = useChat(sessionId ?? '')
  const sentRef = useRef(false)
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [thinkingEnabled, setThinkingEnabledState] = useState(getThinkingEnabled)
  const [webSearchEnabled, setWebSearchEnabledState] = useState(getWebSearchEnabled)

  useEffect(() => {
    getSkills().then(setSkills).catch(() => {})
  }, [])

  useEffect(() => {
    if (!sessionId) return

    if (state?.firstMessage && !sentRef.current) {
      sentRef.current = true
      void sendMessage(state.firstMessage, state.pendingFiles ?? [], state.skillNames ?? undefined, state.webSearchEnabled ?? true)
    } else if (!state?.firstMessage) {
      void loadHistory()
      void loadAttachments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const handleExtractDocument = useCallback(
    (content: string) => extractDocument(sessionId!, content),
    [sessionId],
  )

  const toggleThinking = () => {
    const next = !thinkingEnabled
    setThinkingEnabledState(next)
    setThinkingEnabled(next)
  }

  const toggleWebSearch = () => {
    const next = !webSearchEnabled
    setWebSearchEnabledState(next)
    setWebSearchEnabled(next)
  }

  if (!sessionId) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-border px-6 py-3">
        <p className="truncate text-sm text-muted-foreground">
          {messages.find((m) => m.role === 'human')?.content?.slice(0, 60) ?? 'Nova conversa'}
        </p>
      </div>

      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onRetry={retryLast}
        thinkingEnabled={thinkingEnabled}
        onExtractDocument={handleExtractDocument}
        onSendNextStep={(skillName) => sendNextStep(skillName, webSearchEnabled)}
      />

      <ChatInput
        onSend={(text, skillNames, wsEnabled) => void sendMessage(text, undefined, skillNames, wsEnabled)}
        onStop={stopStreaming}
        disabled={isStreaming}
        isStreaming={isStreaming}
        pendingFiles={pendingFiles}
        onAddFile={addPendingFile}
        onRemoveFile={removePendingFile}
        skills={skills}
        thinkingEnabled={thinkingEnabled}
        onThinkingToggle={toggleThinking}
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={toggleWebSearch}
      />
    </div>
  )
}
