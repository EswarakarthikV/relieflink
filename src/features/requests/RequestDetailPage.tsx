import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Clock, Users, AlertTriangle, ArrowLeft, Phone, PhoneOff, Lock, Shield } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { UrgencyBadge, StatusBadge } from '@/components/ui/Badge'
import { StackedProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { MakeOfferSheet } from '@/features/offers/MakeOfferSheet'
import { useRequest, useRequestItemStats, useRequestContact } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { relativeTime, fmtNumber, fmtPercent } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Request } from '@/types'

export function RequestDetailPage() {
  const { id = '' }    = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const { user }       = useAuth()
  const { data: req, isLoading, isError } = useRequest(id)
  const { data: stats = [] } = useRequestItemStats(id)
  const { data: contact } = useRequestContact(id, {
    allowCalls: req?.allow_calls,
    requesterId: req?.requesterId,
  })

  // Auto-open offer sheet if routed with ?action=donate or ?offer=true
  const shouldAutoOpenOffer = searchParams.get('action') === 'donate' || searchParams.get('offer') === 'true'
  const [offerOpen, setOfferOpen] = useState(shouldAutoOpenOffer)

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

  const displayItems = stats.length > 0
    ? stats.map(s => ({
        id: s.request_item_id,
        name: s.item_name,
        unit: s.unit,
        category: s.category,
        quantity_needed: s.quantity_needed,
        quantity_committed: s.quantity_committed,
        quantity_delivered: s.quantity_delivered,
        quantity_remaining: s.quantity_remaining,
      }))
    : req.items.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        category: i.category,
        quantity_needed: i.quantityRequested,
        quantity_committed: i.quantityCommitted,
        quantity_delivered: i.quantityDelivered,
        quantity_remaining: Math.max(0, i.quantityRequested - i.quantityCommitted),
      }))

  const totalCommitted = displayItems.reduce((s, i) => s + i.quantity_committed, 0)
  const totalDelivered = displayItems.reduce((s, i) => s + i.quantity_delivered, 0)
  const totalRequested = displayItems.reduce((s, i) => s + i.quantity_needed, 0)
  const remaining = displayItems.reduce((s, i) => s + i.quantity_remaining, 0)

  const updatedReq: Request = {
    ...req,
    items: req.items.map(item => {
      const stat = stats.find(s => s.request_item_id === item.id)
      if (!stat) return item
      return {
        ...item,
        quantityRequested: stat.quantity_needed,
        quantityCommitted: stat.quantity_committed,
        quantityDelivered: stat.quantity_delivered,
      }
    }),
  }

  return (
    <>
      <AppShell>
        <TopBar
          title={req.refNumber}
          showBack
          variant="navy"
        />

        <div className="pt-16 px-4 pb-6 space-y-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-brand-600 transition-colors cursor-pointer select-none py-1 -ml-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to requests</span>
          </button>

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

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-ink">
                <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="text-body font-medium">{req.location}</span>
              </div>
              <div>
                <a
                  href={
                    (req.latitude != null && req.longitude != null) ||
                    (req.coordinates?.lat != null && req.coordinates?.lng != null)
                      ? `https://www.google.com/maps/dir/?api=1&destination=${req.latitude ?? req.coordinates?.lat},${req.longitude ?? req.coordinates?.lng}`
                      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          req.address_line && req.city
                            ? `${req.address_line}, ${req.city}`
                            : req.address_line || req.city || req.location || ''
                        )}`
                  }
                  target="_blank"
                  rel="noopener"
                  className="text-[13px] text-ink-muted hover:text-brand-600 transition-colors inline-flex items-center gap-0.5"
                >
                  Get directions ↗
                </a>
              </div>
            </div>

            {/* Item chips (first 2 + "+N more") */}
            {req.items && req.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {req.items.slice(0, 2).map(item => (
                  <span
                    key={item.id}
                    className="text-caption px-2.5 py-1 rounded bg-surface-high text-on-surface-muted font-medium"
                  >
                    {item.category || item.name} · {fmtNumber(item.quantityRequested)} {item.unit}
                  </span>
                ))}
                {req.items.length > 2 && (
                  <span className="text-caption px-2.5 py-1 rounded bg-surface-high text-on-surface-muted font-medium">
                    +{req.items.length - 2} more
                  </span>
                )}
              </div>
            )}

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

          {/* ── Contact Section ─────────────────────────────────────────── */}
          <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3">
            <h2 className="text-h4 font-semibold text-ink">Coordinator Contact</h2>

            {contact ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[12px] text-brand-700 bg-brand-50 border border-brand-200/70 px-2 py-0.5 rounded font-semibold uppercase tracking-wider inline-block">
                      Delivery Coordinator
                    </span>
                    <p className="text-[16px] font-semibold text-navy-900 truncate mt-0.5">
                      {contact.contact_name}
                    </p>
                  </div>
                </div>

                {req.allow_calls !== false ? (
                  <div className="space-y-1.5">
                    <a
                      href={`tel:${contact.contact_phone}`}
                      className="w-full h-[44px] rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-body flex items-center justify-center gap-2 transition-colors active:scale-[0.99] shadow-sm select-none"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call Coordinator ({contact.contact_name})</span>
                    </a>
                    <p className="text-[11px] text-ink-muted text-center flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3 text-brand-600" />
                      Opens phone dialer directly · Phone number protected
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-ink-muted text-caption">
                    <PhoneOff className="w-4 h-4 text-ink-muted shrink-0" />
                    <span>Direct calling is disabled by the coordinator. Coordination is managed through in-app delivery tracking.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-ink-muted text-caption">
                <Lock className="w-4 h-4 shrink-0 text-ink-muted" />
                <span>Contact details are visible to donors with active offers.</span>
              </div>
            )}
          </div>

          {/* ── Items detail ─────────────────────────────────────────── */}
          <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3">
            <h2 className="text-h4 font-semibold text-ink">Items Requested</h2>

            <div className="divide-y divide-slate-100">
              {displayItems.map(item => {
                const pct = fmtPercent(item.quantity_committed, item.quantity_needed)
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
                    <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-ink-muted tnum">
                      <span>{fmtNumber(item.quantity_needed)} {item.unit} needed</span>
                      <span>{fmtNumber(item.quantity_committed)} committed</span>
                      <span>{fmtNumber(item.quantity_delivered)} delivered</span>
                      <span>{fmtNumber(item.quantity_remaining)} remaining</span>
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
              disabled={req.status === 'fulfilled' || req.status === 'closed' || remaining <= 0}
            >
              Make an Offer
            </Button>
            {user?.id && req.requesterId && user.id === req.requesterId && (
              <Button
                variant="secondary"
                fullWidth
                size="lg"
                className="mt-2.5"
                onClick={() => navigate(`/tracker/${req.id}`)}
              >
                Track this request →
              </Button>
            )}
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
          request={updatedReq}
          isOpen={offerOpen}
          onClose={() => setOfferOpen(false)}
        />
      )}
    </>
  )
}
