import type { UrgencyLevel } from '@/types'

// ── Text label ────────────────────────────────────────────────────────────
export const urgencyLabel: Record<UrgencyLevel, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
}

// ── Tailwind classes for badge foreground + background + border ───────────
export const urgencyBadgeClasses: Record<UrgencyLevel, string> = {
  low:      'bg-urgency-low-bg   text-urgency-low      border-slate-300',
  medium:   'bg-urgency-medium-bg text-urgency-medium  border-amber-300',
  high:     'bg-urgency-high-bg  text-urgency-high     border-orange-300',
  critical: 'bg-urgency-critical-bg text-urgency-critical border-red-300',
}

// ── Solid color dot classes ───────────────────────────────────────────────
export const urgencyDotClasses: Record<UrgencyLevel, string> = {
  low:      'bg-urgency-low',
  medium:   'bg-urgency-medium',
  high:     'bg-urgency-high',
  critical: 'bg-urgency-critical',
}

// ── Sort order (lower = higher priority) ─────────────────────────────────
export const urgencyOrder: Record<UrgencyLevel, number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
}

export function sortByUrgency<T extends { urgency: UrgencyLevel }>(items: T[]): T[] {
  return [...items].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
}
