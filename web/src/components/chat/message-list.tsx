import { useEffect, useRef } from 'react'
import { UserMessage } from './user-message'
import { AssistantMessage } from './assistant-message'
import type { ChatMessage } from '@/lib/types'

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className='flex-1 overflow-scroll'>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {messages.map((msg) =>
          msg.role === 'human' ? (
            <UserMessage key={msg.id} content={msg.content} />
          ) : (
            <AssistantMessage key={msg.id} message={msg} />
          ),
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
