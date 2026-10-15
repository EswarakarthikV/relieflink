import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Truck, ChevronRight, X } from 'lucide-react'

interface CreateChooserProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateChooser({ isOpen, onClose }: CreateChooserProps) {
  const navigate = useNavigate()

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelect = (route: string) => {
    onClose()
    navigate(route)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/75 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-chooser-title"
    >
      <div
        className="w-full max-w-md bg-surface rounded-card p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 relative select-none animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="create-chooser-title"
            className="text-[20px] font-semibold text-navy-900 leading-tight tracking-tight"
          >
            What do you want to create?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-slate-100 transition-colors -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-4">
          {/* Card A: Request supplies */}
          <button
            type="button"
            onClick={() => handleSelect('/create')}
            className="w-full text-left bg-surface rounded-card p-4 border border-slate-200 shadow-card hover:shadow-[0_4px_12px_rgba(11,36,71,0.12)] transition-all flex items-center gap-4 group active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-colors">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold text-ink leading-snug group-hover:text-brand-600 transition-colors">
                Request supplies
              </p>
              <p className="text-caption text-ink-muted mt-0.5 leading-relaxed">
                I need items for a relief camp or community
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-muted group-hover:text-brand-600 shrink-0 transition-colors" />
          </button>

          {/* Card B: Start a collection drive */}
          <button
            type="button"
            onClick={() => handleSelect('/create-drive')}
            className="w-full text-left bg-surface rounded-card p-4 border border-slate-200 shadow-card hover:shadow-[0_4px_12px_rgba(11,36,71,0.12)] transition-all flex items-center gap-4 group active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-colors">
              <Truck className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold text-ink leading-snug group-hover:text-brand-600 transition-colors">
                Start a collection drive
              </p>
              <p className="text-caption text-ink-muted mt-0.5 leading-relaxed">
                I'm collecting from my city and delivering to a disaster zone
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-muted group-hover:text-brand-600 shrink-0 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  )
}
