import { useState, type ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { CreateChooser } from '@/features/requests/CreateChooser'
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

  return (
    <div className="min-h-dvh bg-bg-app lg:[&_header]:hidden">
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
