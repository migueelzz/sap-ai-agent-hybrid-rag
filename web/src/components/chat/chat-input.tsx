import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { ArrowUp, Square, Paperclip, X, FileText, Zap, Brain, Globe, Plus, Settings, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { SkillMeta } from '@/lib/types'

const LONG_TEXT_THRESHOLD = 2000

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface ChatInputProps {
  onSend: (text: string, skillNames?: string[], webSearchEnabled?: boolean) => void
  onStop?: () => void
  disabled?: boolean
  isStreaming?: boolean
  pendingFiles?: File[]
  onAddFile?: (file: File) => void
  onRemoveFile?: (filename: string) => void
  skills?: SkillMeta[]
  thinkingEnabled?: boolean
  onThinkingToggle?: () => void
  webSearchEnabled?: boolean
  onWebSearchToggle?: () => void
}

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  pendingFiles = [],
  onAddFile,
  onRemoveFile,
  skills = [],
  thinkingEnabled = true,
  onThinkingToggle,
  webSearchEnabled = true,
  onWebSearchToggle,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState<SkillMeta[]>([])
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [skillFilter, setSkillFilter] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const filteredSkills = skills.filter(
    (s) =>
      s.is_active &&
      (!skillFilter ||
        s.name.toLowerCase().includes(skillFilter) ||
        s.title.toLowerCase().includes(skillFilter)),
  )

  const selectSkill = (skill: SkillMeta) => {
    setValue('')
    setSelectedSkills((prev) => (prev.some((s) => s.id === skill.id) ? prev : [...prev, skill]))
    setShowSkillPicker(false)
    setSkillFilter('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }

  const convertToFile = (rawText?: string) => {
    const text = (rawText ?? value).trim()
    if (!text || !onAddFile) return
    const blob = new Blob([text], { type: 'text/plain' })
    const file = new File([blob], `mensagem-${Date.now()}.txt`, { type: 'text/plain' })
    onAddFile(file)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const submit = (text?: string) => {
    const textToSend = (text ?? value).trim()
    if (!textToSend || disabled) return
    if (textToSend.length > LONG_TEXT_THRESHOLD && onAddFile) {
      convertToFile(textToSend)
      return
    }
    setValue('')
    setShowSkillPicker(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const skillNames = selectedSkills.length > 0 ? selectedSkills.map((s) => s.name) : undefined
    setSelectedSkills([])
    onSend(textToSend, skillNames, webSearchEnabled)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSkillPicker) {
      if (e.key === 'Tab' && filteredSkills.length > 0) {
        e.preventDefault()
        selectSkill(filteredSkills[0])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSkillPicker(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.trim().length > LONG_TEXT_THRESHOLD && onAddFile) {
      convertToFile(val)
      return
    }
    setValue(val)
    if (val.startsWith('/')) {
      const filter = val.slice(1).toLowerCase()
      setSkillFilter(filter)
      setShowSkillPicker(true)
    } else {
      setShowSkillPicker(false)
      setSkillFilter('')
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const TEXT_EXTENSIONS = ['.txt', '.md', '.cds', '.py', '.js', '.ts', '.tsx', '.jsx', '.json', '.xml', '.yaml', '.yml', '.sql']

  const addFile = (file: File) => {
    const filename = file.name.toLowerCase()
    const ext = '.' + (filename.split('.').pop() ?? '')
    const isZip = ext === '.zip'
    const isText = TEXT_EXTENSIONS.includes(ext)

    if (!isZip && !isText) return
    if (isText && file.size > 500 * 1024) return
    if (isZip && file.size > 50 * 1024 * 1024) return

    onAddFile?.(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) addFile(file)
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) addFile(file)
  }

  const hasBadges =
    pendingFiles.length > 0 || selectedSkills.length > 0 || thinkingEnabled || webSearchEnabled

  return (
    <div className="bg-background px-4 py-4">
      <div className="mx-auto max-w-2xl space-y-2">
        {/* Badges */}
        {hasBadges && (
          <div className="flex flex-wrap gap-1.5">
            {thinkingEnabled && (
              <div className="flex items-center gap-1.5 rounded-md border border-muted-foreground/20 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                <Brain className="size-3 shrink-0" />
                <span className="font-medium">Pensamento</span>
                <button
                  onClick={onThinkingToggle}
                  aria-label="Desativar pensamento"
                  className="ml-0.5 rounded transition-colors hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            {webSearchEnabled && (
              <div className="flex items-center gap-1.5 rounded-md border border-muted-foreground/20 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                <Globe className="size-3 shrink-0" />
                <span className="font-medium">Pesquisa na web</span>
                <button
                  onClick={onWebSearchToggle}
                  aria-label="Desativar pesquisa na web"
                  className="ml-0.5 rounded transition-colors hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            {selectedSkills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-1.5 rounded-md border border-sidebar-primary/30 bg-sidebar-primary/10 px-2.5 py-1 text-xs text-sidebar-primary"
              >
                <Zap className="size-3 shrink-0" />
                <span className="max-w-48 truncate font-medium">{skill.title}</span>
                <button
                  onClick={() => setSelectedSkills((prev) => prev.filter((s) => s.id !== skill.id))}
                  aria-label="Remover skill"
                  className="ml-0.5 rounded transition-colors hover:text-sidebar-primary/60"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}

            {pendingFiles.map((f) => {
              const isZip = f.name.toLowerCase().endsWith('.zip')
              return (
                <div
                  key={f.name}
                  className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {isZip ? (
                    <Archive className="size-3 shrink-0 text-amber-500/70" />
                  ) : (
                    <FileText className="size-3 shrink-0 text-sidebar-primary/70" />
                  )}
                  <span className="max-w-36 truncate">{f.name}</span>
                  <span className="text-muted-foreground/50">· {formatBytes(f.size)}</span>
                  <button
                    onClick={() => onRemoveFile?.(f.name)}
                    aria-label={`Remover ${f.name}`}
                    className="ml-0.5 rounded hover:text-foreground transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Input principal com skill picker posicionado acima */}
        <div className="relative">
          {/* Skill picker popover */}
          {showSkillPicker && filteredSkills.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              {filteredSkills.map((skill) => (
                <button
                  key={skill.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectSkill(skill)
                  }}
                  className="flex w-full items-start gap-3 border-b border-border/30 px-4 py-3 text-left last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <Zap className="mt-0.5 size-3.5 shrink-0 text-sidebar-primary/70" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{skill.title}</span>
                      <code className="text-[10px] text-muted-foreground">/{skill.name}</code>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {skill.description.slice(0, 100)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 transition-all',
              'focus-within:border-ring/50 focus-within:ring-1 focus-within:ring-ring/20',
              isDragging
                ? 'border-sidebar-primary/60 bg-sidebar-primary/5'
                : 'border-border',
            )}
          >
            {/* Botão de opções */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled && !isStreaming}
                  title="Opções"
                  aria-label="Abrir opções"
                  className="shrink-0"
                >
                  <Plus className="size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="start" className="w-60">
                <DropdownMenuItem
                  onSelect={() => {
                    // Abre o seletor de arquivo após o menu fechar
                    setTimeout(() => fileInputRef.current?.click(), 0)
                  }}
                >
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  Anexar arquivo (texto, .zip)
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuCheckboxItem
                  checked={thinkingEnabled}
                  onCheckedChange={onThinkingToggle}
                  onSelect={(e) => e.preventDefault()}
                >
                  <Brain className="size-3.5 shrink-0 text-muted-foreground" />
                  Pensamento
                </DropdownMenuCheckboxItem>

                <DropdownMenuCheckboxItem
                  checked={webSearchEnabled}
                  onCheckedChange={onWebSearchToggle}
                  onSelect={(e) => e.preventDefault()}
                >
                  <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                  Pesquisa na web
                </DropdownMenuCheckboxItem>

                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Zap className="size-3.5 shrink-0 text-muted-foreground" />
                      Habilidades
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-64 p-0">
                        <div className="max-h-64 overflow-y-auto p-1">
                          {skills.filter((s) => s.is_active).length === 0 ? (
                            <div className="px-3 py-4 text-center">
                              <p className="text-xs text-muted-foreground">Nenhuma habilidade ativa</p>
                            </div>
                          ) : (
                            skills.filter((s) => s.is_active).map((skill) => (
                              <DropdownMenuCheckboxItem
                                key={skill.id}
                                checked={selectedSkills.some((s) => s.id === skill.id)}
                                onCheckedChange={() =>
                                  setSelectedSkills((prev) =>
                                    prev.some((s) => s.id === skill.id)
                                      ? prev.filter((s) => s.id !== skill.id)
                                      : [...prev, skill],
                                  )
                                }
                                onSelect={(e) => e.preventDefault()}
                                className="items-start py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium">{skill.title}</p>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-muted-foreground"
                          onSelect={() => navigate('/skills')}
                        >
                          <Settings className="size-3.5 shrink-0" />
                          Gerenciar habilidades
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </>
              </DropdownMenuContent>
            </DropdownMenu>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.cds,.py,.js,.ts,.tsx,.jsx,.json,.xml,.yaml,.yml,.sql,.zip"
              className="hidden"
              onChange={handleFileInput}
            />

            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={
                isDragging
                  ? 'Solte o arquivo .txt ou .zip aqui…'
                  : skills.length > 0
                    ? 'Faça uma pergunta ou use /skill para ativar uma skill…'
                    : 'Faça uma pergunta sobre SAP…'
              }
              disabled={disabled && !isStreaming}
              rows={1}
              className={cn(
                'flex-1 rounded-none resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50',
                'min-h-6 max-h-50',
              )}
            />

            {isStreaming ? (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onStop}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Parar"
                aria-label="Parar geração"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                onClick={() => submit()}
                disabled={!value.trim() || disabled}
                title="Enviar (Enter)"
                aria-label="Enviar mensagem"
                className="shrink-0"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/40">
          Enter para enviar · Shift+Enter para nova linha · Digite / para skills
        </p>
      </div>
    </div>
  )
}
