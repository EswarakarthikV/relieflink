import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

interface ToastProps {
  message: string | null
  visible: boolean
  variant?: 'success' | 'warning' | 'danger'
}

export function Toast({ message, visible, variant = 'success' }: ToastProps) {
  if (!visible || !message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-out"
    >
      <div className="bg-navy-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-pill shadow-lg border border-white/10 flex items-center gap-2.5 text-caption font-medium">
        {variant === 'warning' ? (
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        ) : variant === 'danger' ? (
          <AlertCircle className="w-4 h-4 text-danger shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        )}
        <span>{message}</span>
      </div>
    </div>
  )
}
