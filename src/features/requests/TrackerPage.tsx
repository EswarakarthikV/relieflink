import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  MapPin,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  Calendar,
  Phone,
  PhoneOff,
  Info,
  Sparkles,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { UrgencyBadge, StatusBadge } from '@/components/ui/Badge'
import { StackedProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { Toast } from '@/components/ui/Toast'
import { useRequest, useRequestItemStats } from '@/hooks/useRequests'
import { useOffers, updateMockOfferStatus, type TrackerOffer } from '@/hooks/useOffers'
import { useDrives } from '@/hooks/useDrives'
import { useAuth } from '@/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { triggerRemotePush } from '@/lib/pushNotifications'
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
  const { data: allDrives = [] } = useDrives()

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [rolePerspective, setRolePerspective] = useState<'requester' | 'donor'>('requester')
  const [loadingOfferId, setLoadingOfferId] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  // Compute matching collection drives targeting this destination or needed items
  const compatibleDrives = allDrives.filter(drive => {
    if (drive.status === 'completed' || drive.status === 'cancelled') return false
    // Match by destination city
    const matchesCity = req?.city && (
      (drive.to_city && drive.to_city.toLowerCase().includes(req.city.toLowerCase())) ||
      (drive.destination_city && drive.destination_city.toLowerCase().includes(req.city.toLowerCase()))
    )
    // Or match by needed item categories
    const neededCategories = (req?.items || []).map(i => (i.category || i.name).toLowerCase())
    const matchesCategory = (drive.needs || []).some(n =>
      neededCategories.some(nc => nc.includes(n.toLowerCase()) || n.toLowerCase().includes(nc))
    )
    return matchesCity || matchesCategory
  })

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

  const [actionModal, setActionModal] = useState<{
    offer: TrackerOffer
    action: 'reject' | 'cancel' | 'decline_pickup'
  } | null>(null)
  const [actionReason, setActionReason] = useState('')

  // ── Action Handlers ───────────────────────────────────────────────────────

  // 1. Requester: Accept offer (direct dropoff)
  const handleAcceptOffer = async (offer: TrackerOffer) => {
    setLoadingOfferId(offer.id)
    setLoadingAction('accept')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('accept_offer', {
          p_offer_id: offer.id,
        })
        if (error) {
          console.warn('RPC accept_offer error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast('Offer accepted')
        }
      } else {
        showToast('Offer accepted')
      }
    } catch (err: any) {
      console.warn('Error calling accept_offer:', err)
      showToast('Offer accepted')
    }

    updateMockOfferStatus(offer.id, 'accepted')

    if (offer.donor_id) {
      triggerRemotePush({
        event: 'offer_accepted',
        recipientUserId: offer.donor_id,
        title: 'Offer Accepted! 🎉',
        body: `Your offer of ${offer.quantity_offered} ${offer.unit} for "${req?.title || 'Relief Request'}" was accepted!`,
        url: `/tracker/${req?.id || id}`,
        tag: `relieflink-accepted-${offer.id}`,
        idempotencyKey: `client-accepted-${offer.id}`,
      }).catch(() => {})
    }

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 2. Requester: Respond to pickup arrangement
  const handleRespondPickup = async (offer: TrackerOffer, accept: boolean, note?: string) => {
    setLoadingOfferId(offer.id)
    setLoadingAction(accept ? 'accept_pickup' : 'decline_pickup')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('respond_to_pickup', {
          p_offer_id: offer.id,
          p_accept: accept,
          p_note: note || '',
        })
        if (error) {
          console.warn('RPC respond_to_pickup error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast(accept ? 'Pickup schedule confirmed' : 'Pickup declined')
        }
      } else {
        showToast(accept ? 'Pickup schedule confirmed' : 'Pickup declined')
      }
    } catch (err: any) {
      console.warn('Error calling respond_to_pickup:', err)
      showToast(accept ? 'Pickup schedule confirmed' : 'Pickup declined')
    }

    updateMockOfferStatus(offer.id, accept ? 'accepted' : 'pending', {
      pickup_status: accept ? 'accepted' : 'declined',
    })

    if (offer.donor_id) {
      triggerRemotePush({
        event: accept ? 'offer_accepted' : 'offer_rejected',
        recipientUserId: offer.donor_id,
        title: accept ? 'Pickup Confirmed ✓' : 'Pickup Declined',
        body: accept
          ? `The coordinator confirmed pickup on ${offer.pickup_date || 'scheduled date'}.`
          : `The coordinator was unable to accommodate the requested pickup schedule.`,
        url: `/tracker/${req?.id || id}`,
        tag: `relieflink-pickup-${offer.id}`,
        idempotencyKey: `client-pickup-${offer.id}-${accept}`,
      }).catch(() => {})
    }

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 3. Donor: Mark as dispatched
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

    if (req?.requesterId) {
      triggerRemotePush({
        event: 'offer_dispatched',
        recipientUserId: req.requesterId,
        title: 'Consignment Dispatched',
        body: `Supplies for "${req.title || 'Relief Request'}" have been dispatched and are on the way!`,
        url: `/requests/${req.id || id}`,
        tag: `relieflink-dispatch-${offer.id}`,
        idempotencyKey: `client-dispatch-${offer.id}`,
      }).catch(() => {})
    }

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 4. Donor: Mark as delivered
  const handleMarkDelivered = async (offer: TrackerOffer) => {
    setLoadingOfferId(offer.id)
    setLoadingAction('delivered_by_donor')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('mark_delivered', {
          p_offer_id: offer.id,
        })
        if (error) {
          console.warn('RPC mark_delivered error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast('Marked as delivered to camp')
        }
      } else {
        showToast('Marked as delivered to camp')
      }
    } catch (err: any) {
      console.warn('Error calling mark_delivered:', err)
      showToast('Marked as delivered to camp')
    }

    updateMockOfferStatus(offer.id, 'delivered', {
      delivered_at: new Date().toISOString(),
      quantity_delivered: offer.quantity_offered,
    })

    if (req?.requesterId) {
      triggerRemotePush({
        event: 'offer_delivered',
        recipientUserId: req.requesterId,
        title: 'Supplies Delivered to Camp',
        body: `Donor marked ${offer.quantity_offered} ${offer.unit} of "${offer.item_name}" as delivered. Please confirm receipt.`,
        url: `/tracker/${req.id || id}`,
        tag: `relieflink-donor-delivered-${offer.id}`,
        idempotencyKey: `client-donor-delivered-${offer.id}`,
      }).catch(() => {})
    }

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 5. Donor: Cancel offer
  const handleCancelOffer = async (offer: TrackerOffer, reason?: string) => {
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

    if (req?.requesterId) {
      triggerRemotePush({
        event: 'offer_cancelled',
        recipientUserId: req.requesterId,
        title: 'Offer Cancelled',
        body: `A donor cancelled their offer for "${req?.title || 'Relief Request'}"${reason ? `: ${reason}` : '.'}`,
        url: `/requests/${req?.id || id}`,
        tag: `relieflink-cancelled-${offer.id}`,
        idempotencyKey: `client-cancelled-${offer.id}`,
      }).catch(() => {})
    }

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 6. Requester: Reject / Decline offer
  const handleRejectOffer = async (offer: TrackerOffer, reason?: string) => {
    setLoadingOfferId(offer.id)
    setLoadingAction('remove')
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('reject_offer', {
          p_offer_id: offer.id,
          p_reason: reason || 'Declined by coordinator',
        })
        if (error) {
          console.warn('RPC reject_offer error:', error)
          showToast(`Error: ${error.message}`)
        } else {
          showToast('Offer declined')
        }
      } else {
        showToast('Offer declined')
      }
    } catch (err: any) {
      console.warn('Error calling reject_offer:', err)
      showToast('Offer declined')
    }

    updateMockOfferStatus(offer.id, 'rejected')

    if (offer.donor_id) {
      triggerRemotePush({
        event: 'offer_rejected',
        recipientUserId: offer.donor_id,
        title: 'Offer Declined',
        body: `Your offer for "${req?.title || 'Relief Request'}" was declined${reason ? `: ${reason}` : '.'}`,
        url: `/requests/${req?.id || id}`,
        tag: `relieflink-rejected-${offer.id}`,
        idempotencyKey: `client-rejected-${offer.id}`,
      }).catch(() => {})
    }

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  // 7. Requester: Confirm delivery
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

    if (offer.donor_id) {
      triggerRemotePush({
        event: 'offer_delivered',
        recipientUserId: offer.donor_id,
        title: 'Delivery Confirmed',
        body: `Your offer for "${req?.title || 'Relief Request'}" was received and verified. Thank you!`,
        url: `/requests/${req?.id || id}`,
        tag: `relieflink-delivered-${offer.id}`,
        idempotencyKey: `client-delivered-${offer.id}`,
      }).catch(() => {})
    }

    await refetchAll()
    setLoadingOfferId(null)
    setLoadingAction(null)
  }

  const handleModalConfirm = async () => {
    if (!actionModal) return
    const { offer, action } = actionModal
    setActionModal(null)
    const reason = actionReason.trim()
    setActionReason('')

    if (action === 'reject') {
      await handleRejectOffer(offer, reason)
    } else if (action === 'decline_pickup') {
      await handleRespondPickup(offer, false, reason)
    } else if (action === 'cancel') {
      await handleCancelOffer(offer, reason)
    }
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

        {/* ── Suggested Matches (Private to Request Owner / Requester View) ── */}
        {rolePerspective === 'requester' && compatibleDrives.length > 0 && remaining > 0 && (
          <div className="bg-surface rounded-card border border-brand-200/90 shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-body font-semibold text-navy-900 leading-snug">
                    Suggested Relief Matches
                  </h3>
                  <p className="text-[12px] text-ink-muted">
                    Active collection drives moving supplies to your destination.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-brand-50 text-brand-700 border border-brand-200">
                {compatibleDrives.length} available
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {compatibleDrives.slice(0, 3).map(drive => (
                <div
                  key={drive.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-brand-300 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span className="font-semibold text-[13px] text-navy-900 truncate">
                        {drive.title || `${drive.from_city} to ${drive.to_city} Drive`}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-muted mt-0.5 truncate">
                      Departing {drive.from_city} &rarr; {drive.to_city || drive.destination_city} ({drive.departure_date || 'Upcoming'})
                    </p>
                    {drive.needs && drive.needs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {drive.needs.slice(0, 3).map((need, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-ink-muted font-medium">
                            {need}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link to={`/drives/${drive.id}`} className="shrink-0">
                    <Button size="sm" variant="secondary" className="text-xs h-8 px-2.5">
                      View Drive
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-muted italic">
              * Matches are suggestions only. No supplies or records are transferred automatically.
            </p>
          </div>
        )}

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

                    {/* Pickup Info Banner if delivery_method === 'pickup' */}
                    {offer.delivery_method === 'pickup' && (
                      <div className="bg-blue-50/70 border border-blue-200/90 rounded-card p-3 text-caption space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-brand-600" />
                            <span>Pickup Arrangement</span>
                          </span>
                          <span
                            className={cn(
                              'text-[10px] uppercase font-bold px-2 py-0.5 rounded-pill border',
                              offer.pickup_status === 'accepted'
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : offer.pickup_status === 'declined'
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300',
                            )}
                          >
                            {offer.pickup_status === 'accepted'
                              ? 'Pickup Confirmed ✓'
                              : offer.pickup_status === 'declined'
                                ? 'Pickup Declined'
                                : 'Awaiting Confirmation'}
                          </span>
                        </div>

                        {offer.pickup_date && (
                          <div className="flex items-center gap-1.5 text-ink-muted">
                            <Calendar className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            <span>
                              {offer.pickup_date}{' '}
                              {offer.pickup_time_window && `(${offer.pickup_time_window})`}
                            </span>
                          </div>
                        )}

                        {offer.pickup_address && (
                          <div className="flex items-center gap-1.5 text-ink-muted">
                            <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            <span className="truncate">{offer.pickup_address}</span>
                          </div>
                        )}

                        {offer.delivery_method === 'pickup' && (
                          <div className="pt-0.5">
                            {(offer as any).allow_calls === false ? (
                              <span className="text-[11px] text-ink-muted flex items-center gap-1">
                                <PhoneOff className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                                <span>Calling disabled by donor</span>
                              </span>
                            ) : offer.pickup_contact ? (
                              <a
                                href={`tel:${offer.pickup_contact}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80 text-[12px] font-semibold transition-colors active:scale-95 shadow-2xs select-none"
                              >
                                <Phone className="w-3.5 h-3.5 text-brand-600" />
                                <span>Call Donor for Pickup</span>
                              </a>
                            ) : null}
                          </div>
                        )}

                        {offer.pickup_notes && (
                          <p className="text-[12px] text-ink italic mt-1 border-t border-blue-100 pt-1">
                            Note: {offer.pickup_notes}
                          </p>
                        )}
                      </div>
                    )}

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

                      const showDonorActions = isActualDonor || (!isActualRequester && rolePerspective === 'donor')
                      const showRequesterActions = isActualRequester || (!isActualDonor && rolePerspective === 'requester')

                      const isPickup = offer.delivery_method === 'pickup'

                      return (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          {/* 1. PENDING OFFERS */}
                          {offer.status === 'pending' && (
                            <>
                              {/* Direct Dropoff - Requester options */}
                              {!isPickup && showRequesterActions && (
                                <div className="flex items-center justify-between gap-3">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    isLoading={loadingOfferId === offer.id && loadingAction === 'accept'}
                                    disabled={Boolean(loadingOfferId)}
                                    onClick={() => handleAcceptOffer(offer)}
                                  >
                                    Accept Offer
                                  </Button>
                                  <button
                                    type="button"
                                    disabled={Boolean(loadingOfferId)}
                                    onClick={() => setActionModal({ offer, action: 'reject' })}
                                    className="text-danger hover:underline text-caption font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}

                              {/* Pickup - Requester options */}
                              {isPickup && showRequesterActions && (
                                <div className="flex items-center justify-between gap-3">
                                  {offer.pickup_status !== 'accepted' && offer.pickup_status !== 'declined' ? (
                                    <>
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        isLoading={loadingOfferId === offer.id && loadingAction === 'accept_pickup'}
                                        disabled={Boolean(loadingOfferId)}
                                        onClick={() => handleRespondPickup(offer, true)}
                                      >
                                        Accept Pickup
                                      </Button>
                                      <button
                                        type="button"
                                        disabled={Boolean(loadingOfferId)}
                                        onClick={() => setActionModal({ offer, action: 'decline_pickup' })}
                                        className="text-danger hover:underline text-caption font-semibold cursor-pointer disabled:opacity-50"
                                      >
                                        Decline Pickup
                                      </button>
                                    </>
                                  ) : offer.pickup_status === 'accepted' ? (
                                    <span className="text-caption text-green-700 font-medium">
                                      Pickup confirmed. Waiting for dispatch/delivery.
                                    </span>
                                  ) : (
                                    <span className="text-caption text-danger font-medium">
                                      Pickup arrangement was declined.
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Donor options for pending */}
                              {showDonorActions && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      isLoading={loadingOfferId === offer.id && loadingAction === 'dispatch'}
                                      disabled={Boolean(loadingOfferId)}
                                      onClick={() => handleMarkDispatched(offer)}
                                    >
                                      Mark as Dispatched
                                    </Button>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      isLoading={loadingOfferId === offer.id && loadingAction === 'delivered_by_donor'}
                                      disabled={Boolean(loadingOfferId)}
                                      onClick={() => handleMarkDelivered(offer)}
                                    >
                                      Mark as Delivered
                                    </Button>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={Boolean(loadingOfferId)}
                                    onClick={() => setActionModal({ offer, action: 'cancel' })}
                                    className="text-danger hover:underline text-caption font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {/* 2. ACCEPTED OFFERS */}
                          {offer.status === 'accepted' && (
                            <div className="flex items-center justify-between gap-3">
                              {showDonorActions ? (
                                <div className="flex items-center justify-between w-full gap-2">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      isLoading={loadingOfferId === offer.id && loadingAction === 'dispatch'}
                                      disabled={Boolean(loadingOfferId)}
                                      onClick={() => handleMarkDispatched(offer)}
                                    >
                                      Mark as Dispatched
                                    </Button>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      isLoading={loadingOfferId === offer.id && loadingAction === 'delivered_by_donor'}
                                      disabled={Boolean(loadingOfferId)}
                                      onClick={() => handleMarkDelivered(offer)}
                                    >
                                      Mark as Delivered
                                    </Button>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={Boolean(loadingOfferId)}
                                    onClick={() => setActionModal({ offer, action: 'cancel' })}
                                    className="text-danger hover:underline text-caption font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span className="text-caption text-ink-muted font-medium bg-slate-100 px-2.5 py-1 rounded-pill">
                                  Offer accepted. Waiting for shipment or dropoff.
                                </span>
                              )}
                            </div>
                          )}

                          {/* 3. DISPATCHED OFFERS */}
                          {offer.status === 'dispatched' && (
                            <div>
                              {showRequesterActions ? (
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
                              ) : (
                                <div className="text-caption text-ink-muted flex items-center gap-1.5 font-medium py-1">
                                  <Truck className="w-4 h-4 text-warning" />
                                  <span>🚚 Dispatched. Awaiting coordinator confirmation.</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 4. DELIVERED */}
                          {offer.status === 'delivered' && (
                            <div className="text-caption text-success font-semibold flex items-center justify-between bg-success-bg/40 px-3 py-2 rounded-input">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-success" />
                                <span>✓ Delivered & Verified</span>
                              </span>
                              {offer.delivered_at && (
                                <span className="text-[11px] text-ink-muted font-normal">
                                  {formatConfirmedDate(offer.delivered_at)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* 5. CANCELLED OR REJECTED */}
                          {(offer.status === 'cancelled' || offer.status === 'rejected') && (
                            <div className="text-caption text-ink-muted italic py-1 flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5" />
                              <span>{offer.status === 'cancelled' ? 'Offer was cancelled' : 'Offer was declined'}</span>
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

      {/* ── Decline / Cancel Modal ── */}
      <Modal
        isOpen={Boolean(actionModal)}
        onClose={() => {
          setActionModal(null)
          setActionReason('')
        }}
        title={
          actionModal?.action === 'reject'
            ? 'Decline Offer'
            : actionModal?.action === 'decline_pickup'
              ? 'Decline Pickup Arrangement'
              : 'Cancel Offer'
        }
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-caption text-ink-muted">
            {actionModal?.action === 'reject'
              ? 'Please provide a short reason for declining this donation offer so the donor is informed:'
              : actionModal?.action === 'decline_pickup'
                ? 'Explain why this pickup time or location cannot be accommodated:'
                : 'Are you sure you want to cancel your donation offer?'}
          </p>

          <textarea
            className="w-full bg-surface-low border border-slate-200 rounded-input p-2.5 text-caption text-ink outline-none focus:border-brand-600 transition-colors resize-none"
            rows={3}
            placeholder="e.g. We have already met this quota, or unable to coordinate pickup at this location..."
            value={actionReason}
            onChange={e => setActionReason(e.target.value)}
          />

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setActionModal(null)
                setActionReason('')
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              fullWidth
              className="bg-danger hover:bg-red-700 text-white"
              onClick={handleModalConfirm}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </AppShell>
  )
}
