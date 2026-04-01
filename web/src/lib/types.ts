export interface MessageChunk {
  type: 'token' | 'tool_start' | 'tool_end' | 'thinking' | 'error' | 'done'
  content: string
  tool_name?: string | null
  is_document?: boolean
  next_skill?: string | null
}

export interface ToolCall {
  id: string
  name: string
  status: 'running' | 'done'
  output?: string
  toolInput?: Record<string, string>
  sourceDocs?: Array<{ filename: string }>
}

export interface Source {
  type: 'doc' | 'web' | 'file'
  label: string
  filename?: string
  sizeBytes?: number
  url?: string
}

export interface AttachmentMeta {
  id: number
  filename: string
  size_bytes: number
  source_zip?: string
  zip_path?: string
  file_type?: 'text' | 'pdf' | 'image' | 'zip'
  mime_type?: string
}

export interface PdfUploadResponse {
  id: number
  filename: string
  size_bytes: number
  file_type: 'pdf'
}

export interface ImageUploadResponse {
  id: number
  filename: string
  size_bytes: number
  file_type: 'image'
  width: number
  height: number
}

export interface ZipUploadResponse {
  success: boolean
  zip_filename: string
  files_extracted: number
  total_size_bytes: number
  files: Array<{
    filename: string
    zip_path: string
    size_bytes: number
  }>
}

export interface ChatMessage {
  id: string
  role: 'human' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  thinkingContent?: string
  thinkingElapsedMs?: number
  isStreaming?: boolean
  hasError?: boolean
  elapsedMs?: number
  attachments?: AttachmentMeta[]
  isDocument?: boolean
  nextSkill?: string | null
}

export interface Session {
  id: string
  title: string
  customTitle?: string
  pinned?: boolean
  createdAt: string
}

export interface CreateSessionResponse {
  session_id: string
  created_at: string
}

export interface HistoryMessage {
  role: 'human' | 'assistant' | 'tool'
  content: string
  tool_name?: string | null
}

export interface HistoryResponse {
  session_id: string
  messages: HistoryMessage[]
}

export interface SkillMeta {
  id: number
  name: string
  title: string
  description: string
  is_active: boolean
  created_at: string
}

export interface OutputFileMeta {
  path: string
  size: number
  created_at: string
}

export interface SessionMeta {
  id: string
  title: string
  custom_title: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface DailyCalls {
  date: string
  calls: number
}

export interface MetricsSummary {
  total_calls: number
  avg_latency_ms: number
  error_count: number
}

export interface ErrorLog {
  id: number
  session_id: string | null
  timestamp: string
  error_message: string | null
  error_type: string | null
  tool_name: string | null
}
