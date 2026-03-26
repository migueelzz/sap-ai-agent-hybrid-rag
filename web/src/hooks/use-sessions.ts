import { useCallback, useState } from 'react'
import { deleteSessionApi } from '@/lib/api'
import {
  addSession as addSessionStore,
  getSessions,
  removeSession as removeSessionStore,
} from '@/lib/sessions'
import type { Session } from '@/lib/types'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>(() => getSessions())

  const addSession = useCallback((id: string, title: string, createdAt: string) => {
    addSessionStore(id, title, createdAt)
    setSessions(getSessions())
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    removeSessionStore(id)
    setSessions(getSessions())
    try { await deleteSessionApi(id) } catch { /* best-effort */ }
  }, [])

  const refresh = useCallback(() => {
    setSessions(getSessions())
  }, [])

  return { sessions, addSession, deleteSession, refresh }
}
