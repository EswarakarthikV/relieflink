import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { CreateChooser } from '@/features/requests/CreateChooser'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/utils/cn'

interface AppShellProps {
  children: ReactNode
  /** Hide bottom nav (e.g. on Login, full-screen modals) */
  hideNav?: boolean
  className?: string
}

/**
 * AppShell wraps authenticated pages.
 * - Mobile (<1024px): TopBar (in pages) + content (max-w-md, pb-20) + BottomNav
 * - Desktop (>=1024px): Left Sidebar (240px fixed) + content (max-w-5xl, px-8, py-8)
 * - Manages CreateChooser modal state for mobile (+) and desktop (Create) triggers
 */
export function AppShell({ children, hideNav = false, className }: AppShellProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { unreadCount } = useNotifications()

  return (
    <div className="min-h-dvh bg-bg-app lg:[&_header]:hidden">
      {/* Top-right notification bell icon */}
      {!hideNav && (
        <Link
          to="/notifications"
          aria-label={`Notifications (${unreadCount} unread)`}
          className="fixed top-3.5 right-4 lg:top-6 lg:right-8 z-50 flex items-center justify-center p-1.5 rounded-full text-ink-muted hover:text-brand-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <div className="relative flex items-center justify-center">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                {unreadCount}
              </span>
            )}
          </div>
        </Link>
      )}
      {/* Desktop fixed sidebar (>=1024px) */}
      <Sidebar
        className="hidden lg:flex"
        onCreateClick={() => setIsCreateOpen(true)}
      />

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-h-dvh lg:ml-[240px] lg:max-w-none">
        <main
          className={cn(
            // Mobile layout (<1024px)
            'flex-1 flex flex-col w-full max-w-md mx-auto px-4 pt-safe',
            !hideNav && 'pb-20',
            // Desktop layout (>=1024px)
            'lg:max-w-5xl lg:mx-auto lg:px-8 lg:py-8',
            className,
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation (<1024px) */}
      {!hideNav && (
        <div className="lg:hidden">
          <BottomNav onCreateClick={() => setIsCreateOpen(true)} />
        </div>
      )}

      {/* Create Chooser Modal */}
      <CreateChooser
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  )
}
