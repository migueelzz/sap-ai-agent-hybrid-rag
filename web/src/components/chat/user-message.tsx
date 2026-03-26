interface UserMessageProps {
  content: string
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-muted px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}
