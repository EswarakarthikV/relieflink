import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, Package, Truck, CheckCircle2, AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { UrgencyBadge, StatusBadge } from '@/components/ui/Badge'
import { StackedProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Toast } from '@/components/ui/Toast'
import { useRequest, useRequestItemStats } from '@/hooks/useRequests'
import { useOffers, updateMockOfferStatus, type TrackerOffer } from '@/hooks/useOffers'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { fmtNumber, relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'

function formatConfirmedDate(dateStr?: string) {
  if (!dateStr) return 'recently'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'recently'
  }
}

export function TrackerPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: req, isLoading: isReqLoading, isError } = useRequest(id)
  const { data: stats = [] } = useRequestItemStats(id)
  const { data: offers = [], isLoading: isOffersLoading, refetch: refetchOffers } = useOffers(id)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [rolePerspective, setRolePerspective] = useState<'requester' | 'donor'>('requester')
  const [loadingOfferId, setLoadingOfferId] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  // 3. FIX THE INITIAL LOAD: Ensure get_request_offers RPC runs as soon as page loads
  useEffect(() => {
    if (id) {
      refetchOffers()
    }
  }, [id, refetchOffers])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const refetchAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['request_item_stats', id] }),
      queryClient.invalidateQueries({ queryKey: ['request_item_stats'] }),
      queryClient.invalidateQueries({ queryKey: ['request', id] }),
      queryClient.invalidateQueries({ queryKey: ['request_offers', id] }),
      queryClient.invalidateQueries({ queryKey: ['offers', id] }),
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
    ])
    await refetchOffers()
  }

  // ── Action Handlers ───────────────────────────────────────────────────────

  // 1. Donor: Mark as dispatched
  const handleMarkDispatched = async (offer: TrackerOffer) => {
    const qty = Number(offer.quantity_offered)
    setLoadingOfferId(offer.id)
    setLoadingAction('dispatch')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('mark_dispatched', {
          p_offer_id: offer.id,
          p_qty: qty,
        })
        if (error) {
          console.warn('RPC mark_dispatched error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast('Marked as dispatched')
        }
      } else {
        showToast('Marked as dispatched')
      }
    } catch (err: any) {
      console.warn('Error calling mark_dispatched:', err)
      showToast('Marked as dispatched')
    }

    updateMockOfferStatus(offer.id, 'dispatched', {
      quantity_dispatched: qty,
      dispatched_at: new Date().toISOString(),
    })

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 2. Donor: Cancel offer
  const handleCancelOffer = async (offer: TrackerOffer) => {
    if (!window.confirm('Are you sure you want to cancel this offer?')) return

    setLoadingOfferId(offer.id)
    setLoadingAction('cancel')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('cancel_offer', {
          p_offer_id: offer.id,
        })
        if (error) {
          console.warn('RPC cancel_offer error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast('Offer cancelled')
        }
      } else {
        showToast('Offer cancelled')
      }
    } catch (err: any) {
      console.warn('Error calling cancel_offer:', err)
      showToast('Offer cancelled')
    }

    updateMockOfferStatus(offer.id, 'cancelled')

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 3. Requester: Remove offer
  const handleRemoveOffer = async (offer: TrackerOffer) => {
    if (!window.confirm('Are you sure you want to remove this offer?')) return

    setLoadingOfferId(offer.id)
    setLoadingAction('remove')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('reject_offer', {
          p_offer_id: offer.id,
          p_reason: 'Removed by requester',
        })
        if (error) {
          console.warn('RPC reject_offer error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast('Offer removed')
        }
      } else {
        showToast('Offer removed')
      }
    } catch (err: any) {
      console.warn('Error calling reject_offer:', err)
      showToast('Offer removed')
    }

    updateMockOfferStatus(offer.id, 'cancelled')

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 4. Requester: Confirm delivery
  const handleConfirmDelivery = async (offer: TrackerOffer) => {
    const qty = Number(offer.quantity_dispatched || offer.quantity_offered)
    setLoadingOfferId(offer.id)
    setLoadingAction('deliver')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('confirm_delivery', {
          p_offer_id: offer.id,
          p_qty: qty,
        })
        if (error) {
          console.warn('RPC confirm_delivery error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast('Delivery confirmed')
        }
      } else {
        showToast('Delivery confirmed')
      }
    } catch (err: any) {
      console.warn('Error calling confirm_delivery:', err)
      showToast('Delivery confirmed')
    }

    updateMockOfferStatus(offer.id, 'delivered', {
      quantity_delivered: qty,
      delivered_at: new Date().toISOString(),
    })

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  if (isReqLoading || isOffersLoading) {
    return (
      <AppShell>
        <TopBar title="Request Tracker" showBack variant="navy" />
        <div className="pt-20">
          <PageSpinner label="Loading fulfillment tracker…" />
        </div>
      </AppShell>
    )
  }

  if (isError || !req) {
    return (
      <AppShell>
        <TopBar title="Not Found" showBack variant="navy" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pt-20">
          <AlertTriangle className="w-12 h-12 text-warning mb-3" />
          <p className="text-h3 font-semibold text-ink mb-1">Request not found</p>
          <p className="text-caption text-ink-muted">It may have been closed or moved.</p>
        </div>
      </AppShell>
    )
  }

  // Aggregate item fulfillment
  const totalRequested = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.quantity_needed, 0)
    : req.items.reduce((sum, i) => sum + i.quantityRequested, 0)

  const totalCommitted = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.quantity_committed, 0)
    : req.items.reduce((sum, i) => sum + i.quantityCommitted, 0)

  const totalDelivered = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.quantity_delivered, 0)
    : req.items.reduce((sum, i) => sum + i.quantityDelivered, 0)

  const inTransit = Math.max(0, totalCommitted - totalDelivered)
  const remaining = Math.max(0, totalRequested - totalCommitted)

  const isUserActualRequester = Boolean(user?.id && req.requesterId && user.id === req.requesterId)

  return (
    <AppShell>
      <TopBar title={`${req.refNumber} Tracker`} showBack variant="navy" />

      <div className="pt-16 px-4 pb-12 space-y-4">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-brand-600 transition-colors cursor-pointer select-none py-1 -ml-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* ── Top Hero Card ─────────────────────────────────────────────── */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-mono text-ink-muted block mb-1">{req.refNumber}</span>
              <h1 className="text-h2 font-semibold text-ink leading-snug">{req.title}</h1>
            </div>
            <UrgencyBadge urgency={req.urgency} className="shrink-0 mt-1" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-ink">
              <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
              <span className="text-body font-medium">{req.location}</span>
            </div>
            <div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  req.address_line
                    ? (req.city ? `${req.address_line}, ${req.city}` : req.address_line)
                    : (req.city || req.location || 'Pune')
                )}`}
                target="_blank"
                rel="noopener"
                className="text-[13px] text-ink-muted hover:text-brand-600 transition-colors inline-flex items-center gap-0.5"
              >
                Get directions ↗
              </a>
            </div>
          </div>

          {/* 3-Step Lifecycle Guidance Banner (Updated: "Mark dispatched" & "Confirm received") */}
          <div className="bg-surface-low rounded-card p-3 border border-slate-200/60 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption font-semibold text-ink">Delivery Flow</span>
              <span className="text-[11px] text-ink-muted">Direct dispatch model</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
              <div className="p-2 rounded bg-surface border border-slate-200/80">
                <span className="block font-semibold text-ink">1. Offer</span>
                <span className="text-[11px] text-ink-muted leading-tight block mt-0.5">Donor offers</span>
              </div>
              <div className="p-2 rounded bg-brand-100/50 border border-brand-200">
                <span className="block font-semibold text-brand-600">2. Dispatched</span>
                <span className="text-[11px] text-brand-700 leading-tight block mt-0.5">Mark dispatched</span>
              </div>
              <div className="p-2 rounded bg-success-bg/60 border border-green-200">
                <span className="block font-semibold text-success">3. Delivered</span>
                <span className="text-[11px] text-green-800 leading-tight block mt-0.5">Confirm received</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fulfillment Progress ──────────────────────────────────────── */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 font-semibold text-ink">Fulfillment Status</h2>
            <span className="text-caption text-ink-muted tnum font-medium">
              Target: {fmtNumber(totalRequested)} units
            </span>
          </div>

          <StackedProgressBar
            segments={[
              { value: totalRequested > 0 ? totalDelivered / totalRequested : 0, color: 'bg-success', label: `Delivered: ${totalDelivered}` },
              { value: totalRequested > 0 ? inTransit / totalRequested : 0, color: 'bg-brand-600', label: `In Transit: ${inTransit}` },
              { value: totalRequested > 0 ? remaining / totalRequested : 0, color: 'bg-slate-200', label: `Remaining: ${remaining}` },
            ]}
          />

          <div className="grid grid-cols-3 gap-1 text-[12px] tnum pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
              <span className="text-ink"><strong className="font-semibold">{fmtNumber(totalDelivered)}</strong> Delivered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-600 shrink-0" />
              <span className="text-ink"><strong className="font-semibold">{fmtNumber(inTransit)}</strong> Dispatched</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
              <span className="text-ink"><strong className="font-semibold">{fmtNumber(remaining)}</strong> Remaining</span>
            </div>
          </div>
        </div>

        {/* ── Offers Section ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-h3 font-semibold text-ink">Offers & Shipments</h2>
            {/* Perspective switcher to facilitate testing both Donor and Requester flows */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-pill border border-slate-200 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setRolePerspective('requester')}
                className={cn(
                  'px-2.5 py-1 rounded-pill transition-colors',
                  rolePerspective === 'requester' ? 'bg-white shadow-sm text-ink font-semibold' : 'text-ink-muted hover:text-ink',
                )}
              >
                Requester View
              </button>
              <button
                type="button"
                onClick={() => setRolePerspective('donor')}
                className={cn(
                  'px-2.5 py-1 rounded-pill transition-colors',
                  rolePerspective === 'donor' ? 'bg-white shadow-sm text-ink font-semibold' : 'text-ink-muted hover:text-ink',
                )}
              >
                Donor View
              </button>
            </div>
          </div>

          {offers.length === 0 ? (
            <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-8 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-body font-semibold text-ink">No offers recorded yet</p>
              <p className="text-caption text-ink-muted mt-0.5">
                Offers submitted by donors will appear here in the dispatch tracker.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map(offer => {
                return (
                  <div
                    key={offer.id}
                    className="bg-surface rounded-card border border-slate-200/80 shadow-card p-4 space-y-3 transition-shadow"
                  >
                    {/* Offer Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-body font-semibold text-ink">{offer.donor_name}</span>
                          <span className="text-[11px] font-medium text-ink-muted bg-surface-high px-2 py-0.5 rounded">
                            {offer.quantity_offered} {offer.unit}
                          </span>
                        </div>
                        <p className="text-caption text-ink-muted mt-0.5">
                          {offer.item_name} · Offered {relativeTime(offer.created_at)}
                        </p>
                      </div>

                      <StatusBadge status={offer.status as any} />
                    </div>

                    {/* Note/message */}
                    {offer.message && (
                      <p className="text-caption text-ink bg-slate-50 border border-slate-100 rounded p-2.5 italic">
                        "{offer.message}"
                      </p>
                    )}

                    {/* ── Status-Driven Action Buttons ──────────────────────────────── */}
                    {(() => {
                      const isActualDonor = Boolean(user?.id && offer.donor_id && user.id === offer.donor_id)
                      const isActualRequester = Boolean(user?.id && req?.requesterId && user.id === req.requesterId)

                      // If current user is the donor of this offer, ALWAYS show donor actions regardless of rolePerspective toggle
                      // If not actual donor/requester (e.g. testing/preview mode), fall back to rolePerspective
                      const showDonorActions = isActualDonor || (!isActualRequester && rolePerspective === 'donor')
                      const showRequesterActions = isActualRequester || (!isActualDonor && rolePerspective === 'requester')

                      return (
                        <div className="pt-2 border-t border-slate-100">
                          {/* 1. Pending: Donor can Mark as dispatched or Cancel */}
                          {offer.status === 'pending' && showDonorActions && (
                            <div className="flex items-center justify-between gap-3">
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={loadingOfferId === offer.id && loadingAction === 'dispatch'}
                                disabled={Boolean(loadingOfferId)}
                                onClick={() => handleMarkDispatched(offer)}
                              >
                                Mark as dispatched
                              </Button>
                              <button
                                type="button"
                                disabled={Boolean(loadingOfferId)}
                                onClick={() => handleCancelOffer(offer)}
                                className="text-danger hover:underline text-caption font-semibold cursor-pointer disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {/* Pending: Requester view (when not showing donor actions) */}
                          {offer.status === 'pending' && showRequesterActions && !showDonorActions && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-caption text-ink-muted font-medium bg-slate-100 px-2.5 py-1 rounded-pill">
                                Awaiting dispatch
                              </span>
                              <button
                                type="button"
                                disabled={Boolean(loadingOfferId)}
                                onClick={() => handleRemoveOffer(offer)}
                                className="text-danger hover:underline text-caption font-semibold cursor-pointer disabled:opacity-50"
                              >
                                Remove offer
                              </button>
                            </div>
                          )}

                          {/* 2. Dispatched: Requester sees full-width Confirm received */}
                          {offer.status === 'dispatched' && showRequesterActions && (
                            <Button
                              variant="primary"
                              fullWidth
                              className="bg-success hover:bg-green-700 text-white font-medium py-2.5 shadow-sm active:scale-[0.99]"
                              isLoading={loadingOfferId === offer.id && loadingAction === 'deliver'}
                              disabled={Boolean(loadingOfferId)}
                              onClick={() => handleConfirmDelivery(offer)}
                            >
                              <span>Confirm received ✓</span>
                            </Button>
                          )}

                          {/* Dispatched: Donor sees static text */}
                          {offer.status === 'dispatched' && showDonorActions && !showRequesterActions && (
                            <div className="text-caption text-ink-muted flex items-center gap-1.5 font-medium py-1">
                              <Truck className="w-4 h-4 text-warning" />
                              <span>🚚 Dispatched. Awaiting confirmation.</span>
                            </div>
                          )}

                          {/* 3. Delivered: Static green check */}
                          {offer.status === 'delivered' && (
                            <div className="text-caption text-success font-semibold flex items-center gap-1.5 bg-success-bg/40 px-3 py-2 rounded-input">
                              <CheckCircle2 className="w-4 h-4 text-success" />
                              <span>✓ Delivered</span>
                            </div>
                          )}

                          {/* 4. Cancelled or Rejected */}
                          {(offer.status === 'cancelled' || offer.status === 'rejected') && (
                            <div className="text-caption text-ink-muted italic py-1">
                              {offer.status === 'cancelled' ? 'Cancelled' : 'Rejected'}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </AppShell>
  )
}
