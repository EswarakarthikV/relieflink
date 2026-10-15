import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Clock, Users, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { UrgencyBadge, StatusBadge } from '@/components/ui/Badge'
import { StackedProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { MakeOfferSheet } from '@/features/offers/MakeOfferSheet'
import { useRequest } from '@/hooks/useRequests'
import { relativeTime, fmtNumber, fmtPercent } from '@/utils/format'
import { cn } from '@/utils/cn'

export function RequestDetailPage() {
  const { id = '' }    = useParams<{ id: string }>()
  const { data: req, isLoading, isError } = useRequest(id)
  const [offerOpen, setOfferOpen] = useState(false)

  if (isLoading) return (
    <AppShell>
      <TopBar title="Request Details" showBack variant="navy" />
      <div className="pt-16">
        <PageSpinner label="Loading request…" />
      </div>
    </AppShell>
  )

  if (isError || !req) return (
    <AppShell>
      <TopBar title="Not Found" showBack variant="navy" />
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pt-20">
        <AlertTriangle className="w-12 h-12 text-warning mb-3" />
        <p className="text-h3 font-semibold text-ink mb-1">Request not found</p>
        <p className="text-caption text-ink-muted">It may have been closed or moved.</p>
      </div>
    </AppShell>
  )

  const totalCommitted = req.items.reduce((s, i) => s + i.quantityCommitted, 0)
  const totalDelivered = req.items.reduce((s, i) => s + i.quantityDelivered, 0)
  const totalRequested = req.items.reduce((s, i) => s + i.quantityRequested, 0)
  const remaining = totalRequested - totalCommitted

  return (
    <>
      <AppShell>
        <TopBar
          title={req.refNumber}
          showBack
          variant="navy"
        />

        <div className="pt-16 px-4 pb-6 space-y-4">
          {/* ── Header card ─────────────────────────────────────────── */}
          <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-mono text-ink-muted block mb-1">{req.refNumber}</span>
                <h1 className="text-h2 font-semibold text-ink leading-snug">{req.title}</h1>
              </div>
              <UrgencyBadge urgency={req.urgency} className="shrink-0 mt-1" />
            </div>

            {req.disasterContext && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-brand-100 text-brand-600 text-caption font-medium">
                {req.disasterContext}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-ink">
              <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
              <span className="text-body font-medium">{req.location}</span>
            </div>

            <div className="flex items-center gap-4 text-caption text-ink-muted pt-1">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Updated {relativeTime(req.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{req.donorCount} donors</span>
              </div>
              <StatusBadge status={req.status as 'open' | 'fulfilled'} />
            </div>
          </div>

          {/* ── Fulfillment progress ─────────────────────────────────── */}
          <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-h4 font-semibold text-ink">Supply Fulfillment</h2>
              <span className="text-caption text-ink-muted tnum">
                Target: {fmtNumber(totalRequested)} units
              </span>
            </div>

            <StackedProgressBar
              segments={[
                { value: totalDelivered / totalRequested, color: 'bg-success',   label: `Delivered: ${totalDelivered}` },
                { value: (totalCommitted - totalDelivered) / totalRequested, color: 'bg-brand-600', label: `In Transit: ${totalCommitted - totalDelivered}` },
                { value: remaining / totalRequested, color: 'bg-slate-200',  label: `Remaining: ${remaining}` },
              ]}
            />

            <div className="grid grid-cols-3 gap-1 text-[12px] tnum">
              {[
                { color: 'bg-success',   label: 'Delivered', value: totalDelivered },
                { color: 'bg-brand-600', label: 'In Transit', value: totalCommitted - totalDelivered },
                { color: 'bg-slate-300', label: 'Remaining', value: remaining },
              ].map(seg => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', seg.color)} />
                  <span className="text-ink"><strong className="font-semibold">{fmtNumber(seg.value)}</strong> {seg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Items detail ─────────────────────────────────────────── */}
          <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3">
            <h2 className="text-h4 font-semibold text-ink">Items Requested</h2>
            <div className="divide-y divide-slate-100">
              {req.items.map(item => {
                const pct = fmtPercent(item.quantityCommitted, item.quantityRequested)
                return (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-body font-medium text-ink">{item.name}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-100 text-brand-600">{pct} met</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-600 h-full transition-all duration-500 rounded-full"
                        style={{ width: pct }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-caption text-ink-muted tnum">
                      <span>{fmtNumber(item.quantityCommitted)} committed</span>
                      <span>{fmtNumber(item.quantityRequested - item.quantityCommitted)} remaining</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── CTA ──────────────────────────────────────────────────── */}
          <div className="pt-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => setOfferOpen(true)}
              disabled={req.status === 'fulfilled' || req.status === 'closed'}
            >
              Make an Offer
            </Button>
            {remaining <= 0 && (
              <p className="text-caption text-success text-center mt-2 font-medium">
                ✓ This request is fully committed!
              </p>
            )}
          </div>
        </div>
      </AppShell>

      {/* ── Make Offer Bottom Sheet ──────────────────────────────────── */}
      {req && (
        <MakeOfferSheet
          request={req}
          isOpen={offerOpen}
          onClose={() => setOfferOpen(false)}
        />
      )}
    </>
  )
}
