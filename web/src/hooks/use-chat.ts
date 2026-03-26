import { useCallback, useRef, useState } from 'react'
import { getHistory, streamMessage } from '@/lib/api'
import type { ChatMessage, ToolCall } from '@/lib/types'

function uuid() {
  return crypto.randomUUID()
}

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const history = await getHistory(sessionId)
      const result: ChatMessage[] = []
      let i = 0

      while (i < history.messages.length) {
        const msg = history.messages[i]

        if (msg.role === 'human') {
          result.push({ id: uuid(), role: 'human', content: msg.content })
          i++
        } else if (msg.role === 'assistant') {
          const toolCalls: ToolCall[] = []
          i++
          // Tool messages imediatamente seguintes pertencem a esta resposta
          while (i < history.messages.length && history.messages[i].role === 'tool') {
            toolCalls.push({ id: uuid(), name: 'rag_search', status: 'done' })
            i++
          }
          result.push({
            id: uuid(),
            role: 'assistant',
            content: msg.content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          })
        } else {
          i++
        }
      }

      setMessages(result)
    } catch {
      // sessão nova ou sem histórico
    }
  }, [sessionId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return

      const assistantId = uuid()
      setMessages((prev) => [
        ...prev,
        { id: uuid(), role: 'human', content: text },
        { id: assistantId, role: 'assistant', content: '', toolCalls: [], isStreaming: true },
      ])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      let currentContent = ''
      let currentTools: ToolCall[] = []

      try {
        for await (const chunk of streamMessage(sessionId, text, controller.signal)) {
          if (chunk.type === 'token') {
            currentContent += chunk.content
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m)),
            )
          } else if (chunk.type === 'tool_start' && chunk.tool_name) {
            currentTools = [...currentTools, { id: uuid(), name: chunk.tool_name, status: 'running' }]
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: currentTools } : m)),
            )
          } else if (chunk.type === 'tool_end' && chunk.tool_name) {
            let patched = false
            currentTools = currentTools.map((tc) => {
              if (!patched && tc.name === chunk.tool_name && tc.status === 'running') {
                patched = true
                return { ...tc, status: 'done' as const, output: chunk.content }
              }
              return tc
            })
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: currentTools } : m)),
            )
          } else if (chunk.type === 'done' || chunk.type === 'error') {
            if (chunk.type === 'error') {
              currentContent += `\n\n_Erro: ${chunk.content}_`
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m)),
              )
            }
            break
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: '_Erro de conexão com o servidor._' }
                : m,
            ),
          )
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
        )
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [sessionId, isStreaming],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, isStreaming, sendMessage, loadHistory, stopStreaming }
}
