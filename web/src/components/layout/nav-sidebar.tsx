import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, Plus, SquarePen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface NavSidebarProps {
  open?: boolean
  onClose?: () => void
}

export function NavSidebar({ open, onClose }: NavSidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'flex h-screen w-14 flex-col items-center border-r border-border bg-sidebar py-3 z-50',
          // Desktop: always visible
          'md:relative md:translate-x-0 md:flex',
          // Mobile: fixed, slide in/out
          'fixed top-0 left-0 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Logo / close button on mobile */}
        <div className="mb-4 flex flex-col items-center gap-2">
          <Link to="/" onClick={onClose}>
            <div className="flex items-center justify-center rounded-lg select-none">
              <img src="/prime-control-logo-background.png" className="object-cover size-8" alt="Logo" />
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Nav actions */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          <Link to="/" onClick={onClose}>
            <Button
              variant="ghost"
              size="icon"
              title="Novo chat"
              className={cn(
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                location.pathname === '/' && 'bg-sidebar-accent',
              )}
            >
              <Plus className="size-4" />
            </Button>
          </Link>

          <Link to="/chats" onClick={onClose}>
            <Button
              variant="ghost"
              size="icon"
              title="Conversas"
              className={cn(
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                location.pathname === '/chats' && 'bg-sidebar-accent',
              )}
            >
              <MessageSquare className="size-4" />
            </Button>
          </Link>
        </nav>
      </aside>
    </>
  )
}
