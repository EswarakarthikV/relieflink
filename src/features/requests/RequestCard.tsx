import { Link } from 'react-router-dom'
import { MapPin, ChevronRight, Users } from 'lucide-react'
import { UrgencyBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { relativeTime, fmtDistance, fmtNumber, fulfillmentRatio, fmtPercent } from '@/utils/format'
import type { Request } from '@/types'
import { cn } from '@/utils/cn'

interface RequestCardProps {
  request: Request
  className?: string
}

export function RequestCard({ request, className }: RequestCardProps) {
  const primaryItem = request.items[0]
  const totalCommitted = request.items.reduce((s, i) => s + i.quantityCommitted, 0)
  const totalRequested = request.items.reduce((s, i) => s + i.quantityRequested, 0)
  const ratio = fulfillmentRatio(totalCommitted, totalRequested)

  return (
    <Link
      to={`/requests/${request.id}`}
      className={cn(
        'block bg-surface rounded-card border border-slate-200/80 shadow-card p-4',
        'flex flex-col gap-3 transition-transform active:scale-[0.99]',
        className,
      )}
    >
      {/* Row 1: urgency + time */}
      <div className="flex items-center justify-between">
        <UrgencyBadge urgency={request.urgency} />
        <span className="text-caption text-ink-muted">{relativeTime(request.updatedAt)}</span>
      </div>

      {/* Row 2: title + location */}
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-semibold text-ink leading-snug">{request.title}</h2>
        <div className="flex items-center gap-1 text-caption text-ink-muted">
          <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span className="truncate">
            {request.location}
            {request.distanceKm !== undefined && ` · ${fmtDistance(request.distanceKm)} away`}
          </span>
        </div>
      </div>

      {/* Row 3: item tags */}
      {request.items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {request.items.map(item => (
            <span
              key={item.id}
              className="text-caption px-2.5 py-1 rounded bg-surface-high text-on-surface-muted font-medium"
            >
              {item.name} · {fmtNumber(item.quantityRequested)} {item.unit}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: progress */}
      {primaryItem && (
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between text-caption tnum text-ink">
            <span>{fmtNumber(totalCommitted)} of {fmtNumber(totalRequested)} committed</span>
            <span className="font-semibold text-brand-600">{fmtPercent(totalCommitted, totalRequested)}</span>
          </div>
          <ProgressBar value={ratio} size="sm" />
        </div>
      )}

      {/* Row 5: donor count + CTA */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-caption text-ink-muted">
          <Users className="w-4 h-4" />
          <span>{request.donorCount} donor{request.donorCount !== 1 ? 's' : ''}</span>
        </div>
        <span className="inline-flex items-center gap-0.5 text-caption font-semibold text-brand-600 py-1.5 pl-2 pr-0.5 min-h-touch">
          View details <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  )
}
