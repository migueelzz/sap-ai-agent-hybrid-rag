import { useCallback, useRef, useState } from 'react'
import { getHistory, streamMessage, uploadAttachment, uploadZipAttachment, uploadPdfAttachment, uploadImageAttachment, getAttachments, getOutputFiles } from '@/lib/api'
import type { AttachmentMeta, ChatMessage, ToolCall } from '@/lib/types'

function uuid() {
  return crypto.randomUUID()
}

// Mesmo regex do backend — detecta intenção de documento para restaurar isDocument no histórico
const DOC_INTENT_RE = /\b(documenta[çc][aã]o|documento\s+t[eé]cnico|pesquisa\s+detalhada|pesquisa\s+aprofundada|relat[oó]rio|an[aá]lise\s+detalhada|gere\s+um\s+documento|crie\s+uma?\s+documenta[çc][aã]o)\b/i

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [hasOutputFiles, setHasOutputFiles] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const lastUserTextRef = useRef<string>('')
  const lastSkillNamesRef = useRef<string[] | undefined>(undefined)

  const loadHistory = useCallback(async () => {
    try {
      const [history, sessionFiles] = await Promise.all([
        getHistory(sessionId),
        getAttachments(sessionId).catch(() => [] as AttachmentMeta[]),
      ])
      const result: ChatMessage[] = []
      let i = 0
      let filesAssigned = false

      while (i < history.messages.length) {
        const msg = history.messages[i]

        if (msg.role === 'human') {
          // Strip all injected context (_stream_agent sempre termina com "Pergunta do usuário: {texto}")
          // Isso cobre: arquivos de sessão, skill instructions, web search disabled, etc.
          const QUESTION_MARKER = 'Pergunta do usuário: '
          let content = msg.content
          let msgAttachments: AttachmentMeta[] | undefined

          const markerIdx = content.indexOf(QUESTION_MARKER)
          if (markerIdx !== -1) {
            const hadFiles = content.startsWith('[Contexto de arquivos enviados pelo usuário nesta sessão]')
            content = content.slice(markerIdx + QUESTION_MARKER.length)
            if (hadFiles && !filesAssigned && sessionFiles.length > 0) {
              msgAttachments = sessionFiles
              filesAssigned = true
            }
          }

          result.push({ id: uuid(), role: 'human', content, attachments: msgAttachments })
          i++
        } else if (msg.role === 'assistant') {
          const toolCalls: ToolCall[] = []
          i++
          while (i < history.messages.length && history.messages[i].role === 'tool') {
            const toolMsg = history.messages[i]
            toolCalls.push({ id: uuid(), name: toolMsg.tool_name ?? 'rag_search', status: 'done' })
            i++
          }
          const prevHumanContent = result.length > 0 ? result[result.length - 1].content : ''
          result.push({
            id: uuid(),
            role: 'assistant',
            content: msg.content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            isDocument: DOC_INTENT_RE.test(prevHumanContent),
          })
        } else {
          i++
        }
      }

      setMessages(result)
    } catch {
      // sessão nova ou sem histórico
    }
    // Verificar arquivos de saída gerados
    const outputFiles = await getOutputFiles(sessionId).catch(() => [])
    if (outputFiles.length > 0) setHasOutputFiles(true)
  }, [sessionId])

  const loadAttachments = useCallback(async () => {
    const list = await getAttachments(sessionId)
    setAttachments(list)
  }, [sessionId])

  const addPendingFile = useCallback((file: File) => {
    setPendingFiles((prev) => {
      if (prev.some((f) => f.name === file.name)) return prev
      return [...prev, file]
    })
  }, [])

  const removePendingFile = useCallback((filename: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== filename))
  }, [])

  const sendMessage = useCallback(
    async (text: string, initialFiles?: File[], skillNames?: string[], webSearchEnabled?: boolean) => {
      if (isStreaming) return

      lastUserTextRef.current = text
      lastSkillNamesRef.current = skillNames

      // Fazer upload dos arquivos pendentes primeiro (pendingFiles do estado + initialFiles opcionais)
      const allPendingFiles = [...(initialFiles ?? []), ...pendingFiles]
      const uploadedFiles: AttachmentMeta[] = []
      for (const file of allPendingFiles) {
        try {
          const name = file.name.toLowerCase()
          const isZip = name.endsWith('.zip')
          const isPdf = name.endsWith('.pdf')
          const isImage = /\.(jpe?g|png|webp)$/.test(name)

          if (isZip) {
            const zipResponse = await uploadZipAttachment(sessionId, file)
            const zipMeta: AttachmentMeta = {
              id: Date.now(),
              filename: `${zipResponse.zip_filename} (${zipResponse.files_extracted} arquivos)`,
              size_bytes: zipResponse.total_size_bytes,
              source_zip: zipResponse.zip_filename,
              file_type: 'text',
            }
            uploadedFiles.push(zipMeta)
          } else if (isPdf) {
            const pdfResponse = await uploadPdfAttachment(sessionId, file)
            uploadedFiles.push({
              id: pdfResponse.id,
              filename: pdfResponse.filename,
              size_bytes: pdfResponse.size_bytes,
              file_type: 'pdf',
            })
          } else if (isImage) {
            const imgResponse = await uploadImageAttachment(sessionId, file)
            uploadedFiles.push({
              id: imgResponse.id,
              filename: imgResponse.filename,
              size_bytes: imgResponse.size_bytes,
              file_type: 'image',
            })
          } else {
            const meta = await uploadAttachment(sessionId, file)
            uploadedFiles.push(meta)
          }
        } catch {
          // continua mesmo se um arquivo falhar
        }
      }
      if (uploadedFiles.length > 0) {
        setAttachments((prev) => [...prev, ...uploadedFiles])
        setPendingFiles([])
      }

      const assistantId = uuid()
      const startTime = Date.now()

      setMessages((prev) => [
        ...prev,
        { id: uuid(), role: 'human', content: text, attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined },
        { id: assistantId, role: 'assistant', content: '', toolCalls: [], isStreaming: true },
      ])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      let currentContent = ''
      let currentThinking = ''
      let currentTools: ToolCall[] = []
      let thinkingStartedAt: number | null = null
      let thinkingEnded = false

      try {
        for await (const chunk of streamMessage(sessionId, text, controller.signal, skillNames, webSearchEnabled)) {
          if (chunk.type === 'token') {
            // Registra duração do thinking na chegada do primeiro token de resposta
            if (thinkingStartedAt && !thinkingEnded) {
              thinkingEnded = true
              const elapsed = Date.now() - thinkingStartedAt
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, thinkingElapsedMs: elapsed } : m)),
              )
            }
            currentContent += chunk.content
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m)),
            )
          } else if (chunk.type === 'thinking') {
            if (!thinkingStartedAt) thinkingStartedAt = Date.now()
            currentThinking += chunk.content
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, thinkingContent: currentThinking } : m)),
            )
          } else if (chunk.type === 'tool_start' && chunk.tool_name) {
            let toolInput: Record<string, string> | undefined
            try {
              const parsed = JSON.parse(chunk.content)
              if (parsed && typeof parsed === 'object') {
                toolInput = Object.fromEntries(
                  Object.entries(parsed).map(([k, v]) => [k, String(v)]),
                )
              }
            } catch {
              // conteúdo não é JSON — ignora
            }
            currentTools = [...currentTools, { id: uuid(), name: chunk.tool_name, status: 'running', toolInput }]
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: currentTools } : m)),
            )
          } else if (chunk.type === 'tool_end' && chunk.tool_name) {
            if (chunk.tool_name === 'write_output_file') {
              setHasOutputFiles(true)
            }
            const META_RE = /<!--SOURCES_META:(\[.*?\])-->/s
            let sourceDocs: Array<{ filename: string }> | undefined
            const metaMatch = META_RE.exec(chunk.content ?? '')
            if (metaMatch) {
              try {
                const docs = JSON.parse(metaMatch[1]) as Array<{ filename: string }>
                sourceDocs = docs.filter((d) => d.filename)
              } catch {
                // ignora parse error
              }
            }
            let patched = false
            currentTools = currentTools.map((tc) => {
              if (!patched && tc.name === chunk.tool_name && tc.status === 'running') {
                patched = true
                return { ...tc, status: 'done' as const, output: chunk.content, sourceDocs }
              }
              return tc
            })
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, toolCalls: currentTools } : m)),
            )
          } else if (chunk.type === 'error') {
            if (chunk.content === 'CONTEXT_LIMIT_REACHED') {
              setIsBlocked(true)
              // Remove the optimistic assistant message (empty, never filled)
              setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: chunk.content || 'Erro ao processar resposta.',
                        hasError: true,
                        ...(chunk.next_skill != null && { nextSkill: chunk.next_skill }),
                      }
                    : m,
                ),
              )
            }
            break
          } else if (chunk.type === 'done') {
            // Caso thinking ocorreu mas nenhum token chegou depois (ex: resposta só de thinking)
            if (thinkingStartedAt && !thinkingEnded) {
              thinkingEnded = true
              const elapsed = Date.now() - thinkingStartedAt
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, thinkingElapsedMs: elapsed } : m)),
              )
            }
            if (chunk.is_document || chunk.next_skill) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        ...(chunk.is_document && { isDocument: true }),
                        ...(chunk.next_skill && { nextSkill: chunk.next_skill }),
                      }
                    : m,
                ),
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
                ? { ...m, content: 'Erro de conexão com o servidor.', hasError: true }
                : m,
            ),
          )
        }
      } finally {
        const elapsedMs = Date.now() - startTime
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, elapsedMs } : m)),
        )
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [sessionId, isStreaming, pendingFiles], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const sendNextStep = useCallback(
    (skillName: string, webSearchEnabled = true) => {
      void sendMessage('Continuar análise', undefined, [skillName], webSearchEnabled)
    },
    [sendMessage],
  )

  const retryLast = useCallback(() => {
    if (isStreaming) return
    const lastText = lastUserTextRef.current
    if (!lastText) return
    // Remove a última mensagem do assistente antes de reenviar
    setMessages((prev) => {
      const lastAssistant = [...prev].reverse().findIndex((m) => m.role === 'assistant')
      if (lastAssistant === -1) return prev
      const idx = prev.length - 1 - lastAssistant
      return prev.slice(0, idx)
    })
    void sendMessage(lastText, undefined, lastSkillNamesRef.current)
  }, [isStreaming, sendMessage])

  return {
    messages,
    isStreaming,
    isBlocked,
    hasOutputFiles,
    attachments,
    pendingFiles,
    sendMessage,
    sendNextStep,
    loadHistory,
    loadAttachments,
    stopStreaming,
    retryLast,
    addPendingFile,
    removePendingFile,
  }
}
