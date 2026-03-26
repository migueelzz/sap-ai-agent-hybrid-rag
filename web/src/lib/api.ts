import type { CreateSessionResponse, HistoryResponse, MessageChunk } from './types'

// TODO: Create env.ts with envs
const BASE = 'http://127.0.0.1:8000'

export async function createSession(): Promise<CreateSessionResponse> {
  const res = await fetch(`${BASE}/chat/sessions`, { method: 'POST' })
  if (!res.ok) throw new Error(`Erro ao criar sessão: ${res.status}`)
  return res.json() as Promise<CreateSessionResponse>
}

export async function getHistory(sessionId: string): Promise<HistoryResponse> {
  const res = await fetch(`${BASE}/chat/${sessionId}/history`)
  if (!res.ok) throw new Error(`Erro ao carregar histórico: ${res.status}`)
  return res.json() as Promise<HistoryResponse>
}

export async function deleteSessionApi(sessionId: string): Promise<void> {
  await fetch(`${BASE}/chat/${sessionId}`, { method: 'DELETE' })
}

export async function* streamMessage(
  sessionId: string,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<MessageChunk> {
  const res = await fetch(`${BASE}/chat/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal,
  })

  if (!res.ok) throw new Error(`Erro na requisição: ${res.status}`)
  if (!res.body) throw new Error('Sem corpo na resposta')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      try {
        yield JSON.parse(line.slice(6)) as MessageChunk
      } catch {
        // ignora linhas mal formadas
      }
    }
  }
}
