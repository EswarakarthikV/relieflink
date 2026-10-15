import { cn } from '@/utils/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
}

export function Spinner({ size = 'md', className, label = 'Loading…' }: SpinnerProps) {
  return (
    <div role="status" className={cn('flex items-center justify-center', className)}>
      <span
        className={cn(
          'rounded-full border-brand-100 border-t-brand-600 animate-spin',
          SIZE_CLASSES[size],
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Full-page centered loading state */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[200px]">
      <Spinner size="lg" />
      {label && <p className="text-caption text-ink-muted">{label}</p>}
    </div>
  )
}
