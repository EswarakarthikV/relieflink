import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, MoreVertical } from 'lucide-react'
import { cn } from '@/utils/cn'

interface TopBarProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
  rightSlot?: ReactNode
  /** Navy navy-900 variant (used on brand screens) */
  variant?: 'white' | 'navy'
  className?: string
}

export function TopBar({
  title,
  showBack = false,
  onBack,
  rightSlot,
  variant = 'white',
  className,
}: TopBarProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) { onBack() } else { navigate(-1) }
  }

  const isNavy = variant === 'navy'

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 pt-safe',
        isNavy ? 'bg-navy-900' : 'bg-surface/90 backdrop-blur-md border-b border-slate-200',
        'shadow-[0_1px_8px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      <div
        className={cn(
          'h-16 max-w-lg mx-auto px-4 flex items-center justify-between',
          isNavy ? 'text-white' : 'text-ink',
        )}
      >
        {/* Left slot */}
        <div className="flex items-center gap-2 min-w-[48px]">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="Go back"
              className={cn(
                'min-h-touch min-w-[48px] flex items-center justify-center -ml-2 rounded-input',
                'transition-colors',
                isNavy
                  ? 'hover:bg-white/10 text-white'
                  : 'hover:bg-slate-100 text-ink',
              )}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Centre title */}
        {title && (
          <h1
            className={cn(
              'text-h4 font-semibold tracking-tight truncate px-2 text-center flex-1',
              isNavy ? 'text-white' : 'text-ink',
            )}
          >
            {title}
          </h1>
        )}

        {/* Right slot */}
        <div className="flex items-center gap-1 min-w-[48px] justify-end">
          {rightSlot ?? (
            <button
              aria-label="More options"
              className={cn(
                'min-h-touch min-w-[48px] flex items-center justify-center rounded-input',
                'transition-colors opacity-0 pointer-events-none',
                isNavy ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-100 text-ink',
              )}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
