/**
 * Number & date formatting utilities.
 * All numbers are formatted with tabular figures via JS Intl —
 * the CSS 'tnum' rule handles it for rendered text in JSX.
 */

const numberFmt = new Intl.NumberFormat('en-IN')
const percentFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Format integer with Indian locale grouping, e.g. 1,200 */
export function fmtNumber(n: number): string {
  return numberFmt.format(n)
}

/** Format as whole-number percent, e.g. 60% */
export function fmtPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${percentFmt.format(Math.round((value / total) * 100))}%`
}

/** Compute fulfillment ratio 0–1 */
export function fulfillmentRatio(committed: number, requested: number): number {
  if (requested === 0) return 0
  return Math.min(committed / requested, 1)
}

/** Relative time — e.g. "4h ago", "2d ago" */
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1)  return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

/** Short date, e.g. "26 Oct 2026" */
export function fmtDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** km with one decimal, e.g. "4.2 km" */
export function fmtDistance(km: number): string {
  return `${km.toFixed(1)} km`
}
