import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, MapPin, Package, CheckCircle, ClipboardList } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { UrgencyBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { CardSkeleton } from '@/components/ui/Card'
import { useRequests } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { relativeTime, fmtDistance, fmtNumber } from '@/utils/format'
import { sortByUrgency } from '@/utils/urgency'
import { cn } from '@/utils/cn'
import type { Request } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// ── Activity metric tile ──────────────────────────────────────────────────

function MetricTile({ label, value, sub, iconBg, children }: {
  label: string; value: number | string; sub: string; iconBg: string; children: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-card shadow-card border border-slate-200/80 p-3.5 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-caption text-ink-muted">{label}</span>
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', iconBg)}>
          {children}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[28px] leading-8 font-semibold text-ink tnum tracking-tight">{value}</div>
        <p className="text-[12px] font-medium text-ink-muted mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

// ── Horizontal urgent card ────────────────────────────────────────────────

function UrgentCard({ request }: { request: Request }) {
  const item = request.items[0]
  const pct = item ? item.quantityCommitted / item.quantityRequested : 0

  return (
    <Link
      to={`/requests/${request.id}`}
      className="w-[280px] min-w-[280px] bg-surface rounded-card shadow-card border border-slate-200/80 p-4 flex flex-col justify-between active:scale-tap"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <UrgencyBadge urgency={request.urgency} />
          {request.distanceKm !== undefined && (
            <span className="text-caption text-ink-muted font-medium">{fmtDistance(request.distanceKm)}</span>
          )}
        </div>
        <h4 className="text-h3 font-semibold text-ink leading-snug">{request.title}</h4>
        <div className="flex items-center gap-1.5 mt-1 text-ink-muted">
          <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span className="text-caption truncate">{request.location}</span>
        </div>
      </div>

      {item && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-caption text-ink-muted mb-1.5">
            <span className="tnum font-medium text-ink">{fmtNumber(item.quantityCommitted)} / {fmtNumber(item.quantityRequested)}</span>
            <span>{item.unit} committed</span>
          </div>
          <ProgressBar value={pct} size="sm" />
          <div className="flex justify-end mt-3">
            <span className="min-h-touch inline-flex items-center gap-1 text-caption font-semibold text-brand-600">
              View <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      )}
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export function HomePage() {
  const { user } = useAuth()
  const { data, isLoading } = useRequests()

  const { data: userOffers } = useQuery({
    queryKey: ['user_activity_offers', user?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !user?.id) return null
      const { data, error } = await supabase
        .from('offers')
        .select('id, quantity_offered, quantity_delivered, status')
        .eq('donor_id', user.id)
      if (error) {
        console.warn('Could not fetch user offers:', error)
        return null
      }
      return data
    },
    enabled: Boolean(user?.id),
  })

  const activeOffersCount = userOffers !== null && userOffers !== undefined
    ? userOffers.filter(o => o.status === 'pending' || o.status === 'dispatched' || o.status === 'accepted').length
    : 2

  const deliveredOffersCount = userOffers !== null && userOffers !== undefined
    ? userOffers.filter(o => o.status === 'delivered').length
    : 1

  const totalVolume = userOffers !== null && userOffers !== undefined
    ? userOffers.reduce((sum, o) => sum + (Number(o.quantity_delivered) || Number(o.quantity_offered) || 0), 0)
    : 480

  const allRequests = data?.data ?? []
  const urgentRequests = sortByUrgency(allRequests).filter(
    r => r.urgency === 'critical' || r.urgency === 'high',
  ).slice(0, 5)

  const firstName = user?.name.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell>
      {/* ── TopBar (full-width navy with 16px bottom rounded corners) ─── */}
      <header className="bg-navy-900 w-[calc(100%+2rem)] -mx-4 -mt-safe lg:w-[calc(100%+4rem)] lg:-mx-8 lg:-mt-8 rounded-t-none rounded-b-[16px] px-6 py-4 flex items-center justify-start shadow-md mb-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/icons/icon-192.png"
            alt="ReliefLink"
            className="w-8 h-8 rounded-input object-cover shrink-0 shadow-sm border border-brand-teal/20"
          />
          <span className="text-h4 font-bold text-white tracking-tight">ReliefLink</span>
        </div>
      </header>

      {/* ── Greeting ───────────────────────────────────────────────── */}
      <section className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-h2 font-semibold text-ink tracking-tight">{greeting}, {firstName}</h2>
          <p className="text-caption text-ink-muted flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />
            {allRequests.length} active requests near you
          </p>
        </div>
        {user?.location && (
          <span className="text-caption text-ink-muted bg-surface-container px-2.5 py-1 rounded-pill border border-slate-200">
            {user.location}
          </span>
        )}
      </section>

      {/* ── Urgent nearby (horizontal scroll) ─────────────────────── */}
      <section className="py-3">
        <div className="flex items-center justify-between px-4 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-h4 font-semibold text-ink">Urgent nearby</h3>
            <span className="w-2 h-2 rounded-full bg-danger animate-ping" />
          </div>
          <Link
            to="/browse"
            className="min-h-touch inline-flex items-center text-caption font-semibold text-brand-600 hover:underline"
          >
            View all ({allRequests.length})
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 px-4 scroll-x">
          {isLoading
            ? [0, 1, 2].map(i => (
                <div key={i} className="w-[280px] min-w-[280px]">
                  <CardSkeleton />
                </div>
              ))
            : urgentRequests.map(req => <UrgentCard key={req.id} request={req} />)
          }
        </div>
      </section>

      {/* ── Activity metrics (2×2 grid) ────────────────────────────── */}
      <section className="px-4 py-3">
        <h3 className="text-h4 font-semibold text-ink mb-3">Your activity</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Active" value={activeOffersCount} sub="Active Offers" iconBg="bg-brand-100">
            <Package className="w-4 h-4 text-brand-600" />
          </MetricTile>
          <MetricTile label="Status" value={deliveredOffersCount} sub="Confirmed Delivered" iconBg="bg-success-bg">
            <CheckCircle className="w-4 h-4 text-success" />
          </MetricTile>
          <MetricTile label="Pending" value={allRequests.filter(r => r.status === 'open').length} sub="Open Requests" iconBg="bg-warning-bg">
            <ClipboardList className="w-4 h-4 text-warning" />
          </MetricTile>
          <MetricTile label="Volume" value={totalVolume} sub="This Month (kg)" iconBg="bg-brand-100">
            <AlertTriangle className="w-4 h-4 text-brand-600" />
          </MetricTile>
        </div>
      </section>

      {/* ── Recent updates (list card) ─────────────────────────────── */}
      <section className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-h4 font-semibold text-ink">Recent updates</h3>
          <span className="text-[11px] font-medium text-ink-muted tracking-wider uppercase">Live Feed</span>
        </div>
        <div className="bg-surface rounded-card shadow-card border border-slate-200/80 overflow-hidden">
          {isLoading
            ? [0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 p-3.5 border-b border-slate-100 last:border-0">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))
            : allRequests.slice(0, 3).map((req, i) => (
                <Link
                  key={req.id}
                  to={`/requests/${req.id}`}
                  className={cn(
                    'flex items-center gap-3 p-3.5 hover:bg-slate-50 transition-colors min-h-[56px]',
                    i < 2 && 'border-b border-slate-100',
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-caption font-semibold text-ink truncate">{req.title}</p>
                    <p className="text-caption text-ink-muted">{relativeTime(req.updatedAt)} · {req.location}</p>
                  </div>
                  <UrgencyBadge urgency={req.urgency} />
                </Link>
              ))
          }
        </div>
      </section>
    </AppShell>
  )
}
