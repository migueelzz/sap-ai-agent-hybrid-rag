export interface MessageChunk {
  type: 'token' | 'tool_start' | 'tool_end' | 'error' | 'done'
  content: string
  tool_name?: string | null
}

export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'done'
  output?: string
}

export interface ChatMessage {
  id: string
  role: 'human' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  isStreaming?: boolean
}

export interface Session {
  id: string
  title: string
  createdAt: string
}

export interface CreateSessionResponse {
  session_id: string
  created_at: string
}

export interface HistoryMessage {
  role: 'human' | 'assistant' | 'tool'
  content: string
}

export interface HistoryResponse {
  session_id: string
  messages: HistoryMessage[]
}
