import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronRight,
  MapPin,
  Package,
  CheckCircle,
  ClipboardList,
  Plus,
  Heart,
  Truck,
  Sparkles,
  Calendar,
  ArrowRight,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { UrgencyBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { CardSkeleton } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useRequests } from '@/hooks/useRequests'
import { useDrives } from '@/hooks/useDrives'
import { useAuth } from '@/hooks/useAuth'
import { relativeTime, fmtDistance, fmtNumber } from '@/utils/format'
import { sortByUrgency } from '@/utils/urgency'
import { cn } from '@/utils/cn'
import type { Request } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// ── Activity metric tile ──────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  iconBg,
  children,
}: {
  label: string
  value: number | string
  sub: string
  iconBg: string
  children: React.ReactNode
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
            <span className="tnum font-medium text-ink">
              {fmtNumber(item.quantityCommitted)} / {fmtNumber(item.quantityRequested)}
            </span>
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

// ── Main Page ─────────────────────────────────────────────────────────────

export function HomePage() {
  const { user } = useAuth()
  const { data: requestsData, isLoading: isRequestsLoading } = useRequests()
  const { data: drivesData = [], isLoading: isDrivesLoading } = useDrives()

  const { data: userOffers } = useQuery({
    queryKey: ['user_activity_offers', user?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !user?.id) return null
      const { data, error } = await supabase
        .from('offers')
        .select('id, quantity_offered, quantity_delivered, status, delivery_method, pickup_status')
        .eq('donor_id', user.id)
      if (error) {
        console.warn('Could not fetch user offers:', error)
        return null
      }
      return data
    },
    enabled: Boolean(user?.id),
  })

  const allRequests = requestsData?.data ?? []
  const urgentRequests = sortByUrgency(allRequests)
    .filter(r => r.urgency === 'critical' || r.urgency === 'high')
    .slice(0, 5)

  const activeOffersCount =
    userOffers !== null && userOffers !== undefined
      ? userOffers.filter(o => o.status === 'pending' || o.status === 'dispatched' || o.status === 'accepted').length
      : 0

  const deliveredOffersCount =
    userOffers !== null && userOffers !== undefined
      ? userOffers.filter(o => o.status === 'delivered').length
      : 0

  const totalVolume =
    userOffers !== null && userOffers !== undefined
      ? userOffers.reduce((sum, o) => sum + (Number(o.quantity_delivered) || Number(o.quantity_offered) || 0), 0)
      : 0

  const activeDrivesCount = drivesData.length

  const firstName = user?.name.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell>
      {/* ── TopBar ── */}
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

      {/* ── Greeting ── */}
      <section className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-h2 font-semibold text-ink tracking-tight">
            {greeting}, {firstName}
          </h2>
          <p className="text-caption text-ink-muted flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />
            {allRequests.length} active relief requests across network
          </p>
        </div>
        {user?.location && (
          <span className="text-caption text-ink-muted bg-surface-container px-2.5 py-1 rounded-pill border border-slate-200">
            {user.location}
          </span>
        )}
      </section>

      {/* ── Quick Action Hub ── */}
      <section className="px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Link
            to="/create"
            className="bg-navy-900 text-white rounded-card p-3.5 shadow-sm flex flex-col justify-between hover:bg-navy-800 transition-all active:scale-[0.98]"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-2">
              <Plus className="w-4 h-4 text-brand-100" />
            </div>
            <div>
              <p className="text-body font-bold leading-tight">Request Aid</p>
              <p className="text-[11px] text-white/70 mt-0.5">Post needed supplies</p>
            </div>
          </Link>

          <Link
            to="/browse?type=requests"
            className="bg-surface rounded-card p-3.5 shadow-card border border-slate-200 hover:border-brand-300 transition-all active:scale-[0.98] flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <p className="text-body font-bold text-ink leading-tight">Offer Supplies</p>
              <p className="text-[11px] text-ink-muted mt-0.5">Commit goods & food</p>
            </div>
          </Link>

          <Link
            to="/drives/create"
            className="bg-surface rounded-card p-3.5 shadow-card border border-slate-200 hover:border-purple-300 transition-all active:scale-[0.98] flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mb-2">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-body font-bold text-ink leading-tight">Organize Drive</p>
              <p className="text-[11px] text-ink-muted mt-0.5">Hub-to-camp transit</p>
            </div>
          </Link>

          <Link
            to="/browse?type=nearby"
            className="bg-surface rounded-card p-3.5 shadow-card border border-slate-200 hover:border-brand-300 transition-all active:scale-[0.98] flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 text-brand-600 flex items-center justify-center mb-2">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-body font-bold text-ink leading-tight">Near Me</p>
              <p className="text-[11px] text-ink-muted mt-0.5">Local camps & needs</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Operational Attention Banner ── */}
      <section className="px-4 py-1">
        <div className="bg-brand-50 border border-brand-200 rounded-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-caption font-bold text-navy-900 leading-snug">
                Track your active relief coordination
              </p>
              <p className="text-[12px] text-ink-muted">
                {activeOffersCount} active commitments · Check fulfillment status
              </p>
            </div>
          </div>
          <Link to="/my-activity" className="shrink-0 flex items-center self-start sm:self-center">
            <Button
              size="sm"
              variant="primary"
              rightIcon={<ArrowRight className="w-3.5 h-3.5 shrink-0" />}
              className="h-9 px-3.5 text-[12px] font-semibold flex items-center justify-center gap-1.5 leading-none"
            >
              View Activity
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Urgent Nearby (Horizontal Carousel) ── */}
      <section className="py-3">
        <div className="flex items-center justify-between px-4 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-h4 font-semibold text-ink">Urgent Needs Spotlight</h3>
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
          {isRequestsLoading ? (
            [0, 1, 2].map(i => (
              <div key={i} className="w-[280px] min-w-[280px]">
                <CardSkeleton />
              </div>
            ))
          ) : urgentRequests.length === 0 ? (
            <div className="w-full py-6 text-center bg-surface rounded-card border border-slate-200/80 p-4">
              <p className="text-body font-semibold text-ink">No urgent requests at the moment</p>
              <p className="text-caption text-ink-muted mt-0.5">All community needs are currently met or none have been submitted yet.</p>
            </div>
          ) : (
            urgentRequests.map(req => <UrgentCard key={req.id} request={req} />)
          )}
        </div>
      </section>

      {/* ── Active Collection Drives Section ── */}
      {drivesData.length > 0 && (
        <section className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-purple-700" />
              <h3 className="text-h4 font-semibold text-ink">Active Collection Drives</h3>
            </div>
            <Link
              to="/browse?type=drives"
              className="text-caption font-semibold text-brand-600 hover:underline inline-flex items-center gap-1"
            >
              All drives ({activeDrivesCount}) <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {drivesData.slice(0, 2).map(drive => (
              <Link
                key={drive.id}
                to={`/drives/${drive.id}`}
                className="block bg-surface rounded-card p-4 border border-slate-200/80 shadow-card hover:border-purple-300 transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                      {drive.from_city} → {drive.destination_city || drive.to_city}
                    </span>
                    <h4 className="text-body font-semibold text-ink mt-1">{drive.title}</h4>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-success-bg text-success uppercase tracking-wider">
                    {drive.status || 'Active'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-caption text-ink-muted mt-2">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  <span>Departure: {drive.departure_date || 'Upcoming'}</span>
                  <span>·</span>
                  <MapPin className="w-3.5 h-3.5 text-brand-600" />
                  <span className="truncate">{drive.collection_location || drive.collection_address}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Operational Grid Metrics (2×2) ── */}
      <section className="px-4 py-3">
        <h3 className="text-h4 font-semibold text-ink mb-3">Network Logistics Pulse</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Active Requests"
            value={allRequests.length}
            sub="Across all zones"
            iconBg="bg-warning-bg"
          >
            <ClipboardList className="w-4 h-4 text-warning" />
          </MetricTile>
          <MetricTile
            label="Delivered Aid"
            value={deliveredOffersCount}
            sub="Verified consignments"
            iconBg="bg-success-bg"
          >
            <CheckCircle className="w-4 h-4 text-success" />
          </MetricTile>
          <MetricTile
            label="Transit Drives"
            value={activeDrivesCount}
            sub="Community convoys"
            iconBg="bg-purple-50"
          >
            <Truck className="w-4 h-4 text-purple-700" />
          </MetricTile>
          <MetricTile
            label="Volume (Units)"
            value={totalVolume}
            sub="Committed aid units"
            iconBg="bg-brand-100"
          >
            <Package className="w-4 h-4 text-brand-600" />
          </MetricTile>
        </div>
      </section>

      {/* ── Recent Live Updates ── */}
      <section className="px-4 py-3 pb-24">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-h4 font-semibold text-ink">Recent updates</h3>
          <span className="text-[11px] font-medium text-ink-muted tracking-wider uppercase">Live Feed</span>
        </div>
        <div className="bg-surface rounded-card shadow-card border border-slate-200/80 overflow-hidden">
          {isRequestsLoading ? (
            [0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 p-3.5 border-b border-slate-100 last:border-0">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))
          ) : allRequests.length === 0 ? (
            <div className="p-8 text-center text-caption text-ink-muted">
              No recent activity recorded yet.
            </div>
          ) : (
            allRequests.slice(0, 3).map((req, i) => (
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
                    <p className="text-caption text-ink-muted">
                      {relativeTime(req.updatedAt)} · {req.location}
                    </p>
                  </div>
                  <UrgencyBadge urgency={req.urgency} />
                </Link>
              )))
          }
        </div>
      </section>
    </AppShell>
  )
}
