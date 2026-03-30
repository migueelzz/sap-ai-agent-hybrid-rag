import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession, getSkills } from '@/lib/api'
import { addSession } from '@/lib/sessions'
import { getThinkingEnabled, setThinkingEnabled, getWebSearchEnabled, setWebSearchEnabled } from '@/lib/prefs'
import { HomeInput } from '@/components/home/home-input'
import { SuggestionChips } from '@/components/home/suggestion-chips'
import type { SkillMeta } from '@/lib/types'

export function HomePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [thinkingEnabled, setThinkingEnabledState] = useState(getThinkingEnabled)
  const [webSearchEnabled, setWebSearchEnabledState] = useState(getWebSearchEnabled)

  useEffect(() => {
    getSkills().then(setSkills).catch(() => {})
  }, [])

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

  const handleSubmit = async (text: string, files?: File[], skillNames?: string[], wsEnabled?: boolean) => {
    if (loading) return
    setLoading(true)
    try {
      const { session_id, created_at } = await createSession()
      addSession(session_id, text, created_at)
      navigate(`/chat/${session_id}`, {
        state: { firstMessage: text, pendingFiles: files ?? [], skillNames: skillNames ?? [], webSearchEnabled: wsEnabled ?? webSearchEnabled },
      })
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-2">
        {/* Greeting */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Olá, como posso te ajudar?
          </h1>
        </div>

        <HomeInput
          onSubmit={handleSubmit}
          loading={loading}
          skills={skills}
          thinkingEnabled={thinkingEnabled}
          onThinkingToggle={toggleThinking}
          webSearchEnabled={webSearchEnabled}
          onWebSearchToggle={toggleWebSearch}
        />
        <SuggestionChips onSelect={handleSubmit} />
      </div>
    </div>
  )
}
