import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import type { UrgencyLevel } from '@/types'
import { urgencyLabel, urgencyBadgeClasses, urgencyDotClasses } from '@/utils/urgency'

// ── Urgency badge ─────────────────────────────────────────────────────────

interface UrgencyBadgeProps {
  urgency: UrgencyLevel
  className?: string
}

export function UrgencyBadge({ urgency, className }: UrgencyBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill',
        'text-caption font-semibold border',
        urgencyBadgeClasses[urgency],
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', urgencyDotClasses[urgency])} />
      {urgencyLabel[urgency]}
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────

type StatusVariant = 'pending' | 'accepted' | 'dispatched' | 'delivered' | 'open' | 'fulfilled' | 'closed'

const STATUS_CLASSES: Record<StatusVariant, string> = {
  pending:    'bg-slate-100  text-slate-700  border-slate-300',
  open:       'bg-brand-100  text-brand-600  border-blue-200',
  accepted:   'bg-brand-100  text-brand-600  border-blue-200',
  dispatched: 'bg-warning-bg text-warning    border-amber-200',
  delivered:  'bg-success-bg text-success    border-emerald-200',
  fulfilled:  'bg-success-bg text-success    border-emerald-200',
  closed:     'bg-slate-100  text-slate-500  border-slate-200',
}

const STATUS_LABELS: Record<StatusVariant, string> = {
  pending:    'Pending',
  open:       'Open',
  accepted:   'Accepted',
  dispatched: 'Dispatched',
  delivered:  'Delivered',
  fulfilled:  'Fulfilled',
  closed:     'Closed',
}

interface StatusBadgeProps {
  status: StatusVariant
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-pill',
        'text-caption font-medium border',
        STATUS_CLASSES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Generic pill badge ────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const BADGE_VARIANTS: Record<string, string> = {
  default: 'bg-surface-high text-on-surface-muted border-slate-200',
  primary: 'bg-brand-100   text-brand-600  border-blue-200',
  success: 'bg-success-bg  text-success    border-emerald-200',
  warning: 'bg-warning-bg  text-warning    border-amber-200',
  danger:  'bg-danger-bg   text-danger     border-red-200',
  info:    'bg-info-bg     text-info        border-blue-200',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-pill',
        'text-caption font-medium border',
        BADGE_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
