import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  maxWidth?: string
  overlayClassName?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  maxWidth = 'max-w-md',
  overlayClassName,
}: ModalProps) {
  // 1. Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-navy-900/75 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200 overflow-y-auto overscroll-contain',
        overlayClassName,
      )}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full bg-surface rounded-card p-5 sm:p-6 shadow-2xl border border-slate-100 relative select-none animate-in zoom-in-95 duration-200 max-h-[90dvh] overflow-y-auto my-auto overscroll-contain',
          maxWidth,
          className,
        )}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-surface z-10 pb-2 border-b border-slate-100 -mt-2 -mx-2 px-2">
            <h2 className="text-[20px] font-semibold text-navy-900 leading-tight tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-slate-100 transition-colors -mr-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
