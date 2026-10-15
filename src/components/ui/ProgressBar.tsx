import { cn } from '@/utils/cn'

interface ProgressBarProps {
  /** Value 0–1 */
  value: number
  /** Label shown above the bar on the left */
  label?: string
  /** Label shown above the bar on the right */
  rightLabel?: string
  size?: 'sm' | 'md'
  color?: 'brand' | 'success' | 'warning' | 'danger'
  className?: string
  showPercent?: boolean
}

const COLOR_CLASSES: Record<string, string> = {
  brand:   'bg-brand-600',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
}

const TRACK_CLASSES: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
}

export function ProgressBar({
  value,
  label,
  rightLabel,
  size = 'sm',
  color = 'brand',
  showPercent = false,
  className,
}: ProgressBarProps) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  const resolvedColor = pct >= 100 ? 'success' : color

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {(label || rightLabel || showPercent) && (
        <div className="flex items-baseline justify-between text-caption text-ink-muted tnum">
          {label     && <span>{label}</span>}
          {showPercent && <span className="font-semibold text-brand-600">{pct}%</span>}
          {rightLabel && <span>{rightLabel}</span>}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden bg-slate-200',
          TRACK_CLASSES[size],
        )}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            COLOR_CLASSES[resolvedColor],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Multi-stage stacked progress bar ─────────────────────────────────────

interface StackedSegment {
  value: number   // 0–1 fraction
  color: string   // Tailwind bg class
  label?: string
}

interface StackedProgressBarProps {
  segments: StackedSegment[]
  className?: string
}

export function StackedProgressBar({ segments, className }: StackedProgressBarProps) {
  return (
    <div
      className={cn('w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex', className)}
      role="progressbar"
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          className={cn('h-full', seg.color)}
          style={{ width: `${Math.round(seg.value * 100)}%` }}
          title={seg.label}
        />
      ))}
    </div>
  )
}
