import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface HomeInputProps {
  onSubmit: (text: string) => void
  loading?: boolean
}

export function HomeInput({ onSubmit, loading = false }: HomeInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const text = value.trim()
    if (!text || loading) return
    onSubmit(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-border bg-card px-5 py-4 shadow-sm',
        'focus-within:border-ring/50 focus-within:ring-1 focus-within:ring-ring/20 transition-all',
      )}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Como posso ajudar com SAP hoje?"
        disabled={loading}
        rows={3}
        className="resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
      />

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/40">
          Enter para enviar · Shift+Enter nova linha
        </span>
        <Button
          size="sm"
          onClick={submit}
          disabled={!value.trim() || loading}
          className="gap-1.5"
        >
          <ArrowUp className="size-3.5" />
          Enviar
        </Button>
      </div>
    </div>
  )
}
