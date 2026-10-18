import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  Heart,
  Truck,
  Plus,
  ArrowRight,
  MapPin,
  Calendar,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Card, CardSkeleton } from '@/components/ui/Card'
import { StatusBadge, UrgencyBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuth } from '@/hooks/useAuth'
import { useMyRequests, useRequests } from '@/hooks/useRequests'
import { useUserOffers, type UserOfferItem } from '@/hooks/useOffers'
import { useDrives } from '@/hooks/useDrives'
import type { Request, SupplyItem } from '@/types'
import { fmtNumber, relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'

type ActivityTab = 'all' | 'requests' | 'offers' | 'drives'

export function MyActivityPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<ActivityTab>('all')

  const { data: myRequests = [], isLoading: isReqLoading } = useMyRequests(user?.id)
  const { data: userOffers = [], isLoading: isOffersLoading } = useUserOffers(user?.id)
  const { data: allDrives = [], isLoading: isDrivesLoading } = useDrives()
  const { data: allRequestsData } = useRequests()
  const allRequests: Request[] = Array.isArray(allRequestsData)
    ? allRequestsData
    : (allRequestsData?.data || [])

  // Drives organized by user or demo
  const myDrives = allDrives.filter(d => {
    if (!user?.id) return false
    return d.collector_id === user.id || d.organizer_contact === user.email
  })

  // Fallback demo drive if user is in guest/demo mode and has no drives yet
  const displayedDrives = myDrives.length > 0
    ? myDrives
    : (!user || user.is_anonymous) && allDrives.length > 0
      ? [allDrives[0]]
      : []

  // Compute private suggested requests for this donor based on their donation categories
  const offeredCategories = Array.from(new Set(userOffers.map(o => o.item_name.toLowerCase())))
  const donorSuggestedRequests = allRequests.filter((req: Request) => {
    if (req.status !== 'open') return false
    // Don't suggest user's own requests
    if (user?.id && req.requesterId === user.id) return false
    // Don't suggest requests user already made an offer on
    if (userOffers.some(o => o.request_id === req.id)) return false

    // Check category/item compatibility (items have quantityRequested and quantityCommitted)
    const hasRemaining = req.items?.some((it: SupplyItem) => (it.quantityRequested - (it.quantityCommitted || 0)) > 0)
    if (!hasRemaining) return false

    if (offeredCategories.length === 0) return true
    return req.items?.some((it: SupplyItem) =>
      offeredCategories.some(oc => (it.category || it.name).toLowerCase().includes(oc) || oc.includes((it.category || it.name).toLowerCase()))
    )
  })

  const isLoading = isAuthLoading || isReqLoading || isOffersLoading || isDrivesLoading

  const requestsCount = myRequests.length
  const offersCount = userOffers.length
  const drivesCount = displayedDrives.length
  const totalCount = requestsCount + offersCount + drivesCount

  return (
    <AppShell>
      <TopBar title="My Activity" variant="navy" />

      <div className="pt-16 pb-24">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-h2 font-semibold text-ink">My Activity</h1>
            <p className="text-caption text-ink-muted mt-0.5">
              Track your relief requests, donation commitments, and collection drives
            </p>
          </div>
          <Link to="/create">
            <Button size="sm" variant="primary" className="gap-1">
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </Button>
          </Link>
        </div>

        {/* ── Segmented Tab Control ── */}
        <div className="px-4 pt-2">
          <div className="flex bg-slate-100 p-1 rounded-pill border border-slate-200/80 overflow-x-auto scroll-x">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'flex-1 min-w-[70px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
                activeTab === 'all'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={cn(
                'flex-1 min-w-[100px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
                activeTab === 'requests'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              Requests ({requestsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('offers')}
              className={cn(
                'flex-1 min-w-[105px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
                activeTab === 'offers'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              Donations ({offersCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drives')}
              className={cn(
                'flex-1 min-w-[85px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
                activeTab === 'drives'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              Drives ({drivesCount})
            </button>
          </div>
        </div>

        {/* ── Content Feed ── */}
        <div className="px-4 pt-4 space-y-4">
          {isLoading ? (
            [0, 1, 2].map(i => <CardSkeleton key={i} />)
          ) : totalCount === 0 ? (
            /* Overall Empty State */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-surface rounded-card border border-slate-200/80 shadow-card">
              <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-4">
                <ClipboardList className="w-8 h-8" />
              </div>
              <h2 className="text-h3 font-semibold text-ink mb-1.5">No activity recorded yet</h2>
              <p className="text-caption text-ink-muted max-w-xs mb-6">
                You haven't posted any requests, donation offers, or collection drives yet.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <Link to="/create" className="flex-1">
                  <Button variant="primary" fullWidth size="sm">
                    Post a Request
                  </Button>
                </Link>
                <Link to="/browse" className="flex-1">
                  <Button variant="secondary" fullWidth size="sm">
                    Offer Supplies
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Requests Section (if 'all' or 'requests') */}
              {(activeTab === 'all' || activeTab === 'requests') && (
                <div className="space-y-3">
                  {activeTab === 'all' && myRequests.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 pb-0.5">
                      <ClipboardList className="w-4 h-4 text-brand-600" />
                      <h2 className="text-caption font-bold text-ink uppercase tracking-wider">
                        My Relief Requests ({myRequests.length})
                      </h2>
                    </div>
                  )}

                  {activeTab === 'requests' && myRequests.length === 0 && (
                    <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-8 text-center">
                      <p className="text-body font-semibold text-ink">No requests published</p>
                      <p className="text-caption text-ink-muted mt-1 mb-4">
                        You have not posted any disaster relief requests.
                      </p>
                      <Link to="/create">
                        <Button variant="primary" size="sm">Create Request</Button>
                      </Link>
                    </div>
                  )}

                  {myRequests.map(req => {
                    const primaryItem = req.items[0]
                    const totalNeeded = req.items.reduce((sum, it) => sum + it.quantityRequested, 0)
                    const totalCommitted = req.items.reduce((sum, it) => sum + it.quantityCommitted, 0)
                    const pct = totalNeeded > 0 ? Math.min(1, totalCommitted / totalNeeded) : 0

                    return (
                      <Card key={req.id} className="p-4 space-y-3 border border-slate-200/80 shadow-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                                REQUEST
                              </span>
                              <span className="text-[12px] font-mono text-ink-muted">{req.refNumber}</span>
                            </div>
                            <h3 className="text-body font-semibold text-ink leading-snug">{req.title}</h3>
                          </div>
                          <UrgencyBadge urgency={req.urgency} />
                        </div>

                        <div className="flex items-center gap-1.5 text-caption text-ink-muted">
                          <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span className="truncate">{req.location}</span>
                          <span>·</span>
                          <span>{relativeTime(req.createdAt)}</span>
                        </div>

                        {/* Progress */}
                        {primaryItem && (
                          <div className="bg-surface-low rounded-input p-2.5 space-y-1.5 border border-slate-200/60">
                            <div className="flex items-center justify-between text-caption">
                              <span className="text-ink font-medium">Fulfillment progress</span>
                              <span className="text-ink-muted tnum font-semibold">
                                {fmtNumber(totalCommitted)} / {fmtNumber(totalNeeded)} units ({Math.round(pct * 100)}%)
                              </span>
                            </div>
                            <ProgressBar value={pct} size="sm" />
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                          <StatusBadge status={req.status as any} />
                          <div className="flex items-center gap-2">
                            <Link to={`/requests/${req.id}`}>
                              <Button variant="secondary" size="sm">
                                View Request
                              </Button>
                            </Link>
                            <Link to={`/tracker/${req.id}`}>
                              <Button variant="primary" size="sm" className="gap-1">
                                <span>Track</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}

              {/* 2. Donation Offers Section (if 'all' or 'offers') */}
              {(activeTab === 'all' || activeTab === 'offers') && (
                <div className="space-y-3">
                  {activeTab === 'all' && userOffers.length > 0 && (
                    <div className="flex items-center gap-2 pt-3 pb-0.5">
                      <Heart className="w-4 h-4 text-brand-600" />
                      <h2 className="text-caption font-bold text-ink uppercase tracking-wider">
                        My Donation Offers ({userOffers.length})
                      </h2>
                    </div>
                  )}

                  {activeTab === 'offers' && userOffers.length === 0 && (
                    <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-8 text-center">
                      <p className="text-body font-semibold text-ink">No donation offers yet</p>
                      <p className="text-caption text-ink-muted mt-1 mb-4">
                        You have not committed any supplies to relief requests.
                      </p>
                      <Link to="/browse">
                        <Button variant="primary" size="sm">Browse Requests to Donate</Button>
                      </Link>
                    </div>
                  )}

                  {userOffers.map(offer => (
                    <Card key={offer.id} className="p-4 space-y-3 border border-slate-200/80 shadow-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              DONATION OFFER
                            </span>
                            <span className="text-[11px] font-medium text-ink-muted capitalize">
                              {offer.delivery_method === 'pickup' ? '🚐 Arrange Pickup' : '📦 Direct Dropoff'}
                            </span>
                          </div>
                          <h3 className="text-body font-semibold text-ink">
                            {offer.quantity_offered} {offer.unit} of {offer.item_name}
                          </h3>
                          <p className="text-caption text-ink-muted mt-0.5">
                            For: <strong className="text-ink font-medium">{offer.request_title}</strong>
                          </p>
                        </div>
                        <StatusBadge status={offer.status as any} />
                      </div>

                      {/* Pickup Info Banner if delivery_method === 'pickup' */}
                      {offer.delivery_method === 'pickup' && (
                        <div className="bg-blue-50/60 border border-blue-200/80 rounded-card p-2.5 text-caption space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                            <Truck className="w-3.5 h-3.5 text-blue-700" />
                            <span>Pickup arrangement</span>
                            {offer.pickup_status && (
                              <span className="ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                                {offer.pickup_status}
                              </span>
                            )}
                          </div>
                          {offer.pickup_date && (
                            <div className="flex items-center gap-1 text-ink-muted">
                              <Calendar className="w-3 h-3 text-brand-600" />
                              <span>{offer.pickup_date} {offer.pickup_time_window && `(${offer.pickup_time_window})`}</span>
                            </div>
                          )}
                          {offer.pickup_address && (
                            <div className="flex items-center gap-1 text-ink-muted">
                              <MapPin className="w-3 h-3 text-brand-600" />
                              <span className="truncate">{offer.pickup_address}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Offer Message */}
                      {offer.message && (
                        <p className="text-caption text-ink bg-slate-50 border border-slate-100 rounded p-2 italic">
                          "{offer.message}"
                        </p>
                      )}

                      {/* Action Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[12px] text-ink-muted">
                          Offered {relativeTime(offer.created_at)}
                        </span>
                        <Link to={`/tracker/${offer.request_id}`}>
                          <Button variant="primary" size="sm" className="gap-1">
                            <span>Open Tracker</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}

                  {/* Private Suggested Matches for Donor */}
                  {donorSuggestedRequests.length > 0 && (
                    <div className="bg-surface rounded-card border border-brand-200 shadow-card p-4 space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h3 className="text-body font-semibold text-navy-900 leading-snug">
                              Suggested Requests Matching Your Donations
                            </h3>
                            <p className="text-[12px] text-ink-muted">
                              Open relief requests looking for items you can supply.
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-brand-50 text-brand-700 border border-brand-200">
                          {donorSuggestedRequests.length} suggested
                        </span>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        {donorSuggestedRequests.slice(0, 3).map(mReq => (
                          <div
                            key={mReq.id}
                            className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-brand-300 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[13px] text-navy-900 truncate">
                                  {mReq.title}
                                </span>
                                <UrgencyBadge urgency={mReq.urgency} />
                              </div>
                              <p className="text-[12px] text-ink-muted mt-0.5 truncate">
                                {mReq.location} · {mReq.items?.map((it: SupplyItem) => `${it.quantityRequested - (it.quantityCommitted || 0)} ${it.unit} ${it.name}`).join(', ')}
                              </p>
                            </div>

                            <Link to={`/requests/${mReq.id}?action=donate`} className="shrink-0">
                              <Button size="sm" variant="primary" className="text-xs h-8 px-2.5">
                                Offer Supplies
                              </Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-ink-muted italic">
                        * Private match suggestions require your manual review and offer submission. AI never offers or commits supplies autonomously.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Collection Drives Section (if 'all' or 'drives') */}
              {(activeTab === 'all' || activeTab === 'drives') && (
                <div className="space-y-3">
                  {activeTab === 'all' && displayedDrives.length > 0 && (
                    <div className="flex items-center gap-2 pt-3 pb-0.5">
                      <Truck className="w-4 h-4 text-brand-600" />
                      <h2 className="text-caption font-bold text-ink uppercase tracking-wider">
                        Collection Drives ({displayedDrives.length})
                      </h2>
                    </div>
                  )}

                  {activeTab === 'drives' && displayedDrives.length === 0 && (
                    <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-8 text-center">
                      <p className="text-body font-semibold text-ink">No collection drives organized</p>
                      <p className="text-caption text-ink-muted mt-1 mb-4">
                        Coordinate a supply run from your city to affected relief hubs.
                      </p>
                      <Link to="/drives/create">
                        <Button variant="primary" size="sm">Organize a Drive</Button>
                      </Link>
                    </div>
                  )}

                  {displayedDrives.map(drive => (
                    <Card key={drive.id} className="p-4 space-y-3 border border-slate-200/80 shadow-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                              COLLECTION DRIVE
                            </span>
                            <span className="text-[11px] font-medium text-ink-muted">
                              {drive.from_city} → {drive.destination_city || drive.to_city}
                            </span>
                          </div>
                          <h3 className="text-body font-semibold text-ink leading-snug">{drive.title}</h3>
                        </div>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-success-bg text-success uppercase tracking-wider">
                          {drive.status || 'Active'}
                        </span>
                      </div>

                      <div className="space-y-1 text-caption text-ink-muted">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span className="truncate">Hub: {drive.collection_location || drive.collection_address}</span>
                        </div>
                        {drive.departure_date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            <span>Departure: {drive.departure_date}</span>
                          </div>
                        )}
                      </div>

                      {/* Items preview */}
                      {drive.target_items && drive.target_items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {drive.target_items.slice(0, 3).map((it, idx) => (
                            <span key={idx} className="text-[11px] bg-slate-100 text-ink px-2 py-0.5 rounded border border-slate-200">
                              {it.name}: {it.pledged_quantity || 0}/{it.target_quantity} {it.unit}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                        <Link to={`/drives/${drive.id}`}>
                          <Button variant="secondary" size="sm" className="gap-1">
                            <span>View Drive</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
