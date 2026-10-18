import { useState, useEffect, useRef } from 'react'
import { X, Minus, Plus, Info, CheckCircle, AlertTriangle, Calendar, MapPin, Phone, PhoneOff, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Toast } from '@/components/ui/Toast'
import { Input, Textarea } from '@/components/ui/Input'
import { useCreateOffer, useRequestItemStats } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { addMockOffer } from '@/hooks/useOffers'
import { addNotification } from '@/hooks/useNotifications'
import { fmtNumber, fmtPercent, fulfillmentRatio } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Request, DeliveryMethod, SupplyItem } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { triggerRemotePush } from '@/lib/pushNotifications'

interface MakeOfferSheetProps {
  request: Request
  isOpen: boolean
  onClose: () => void
}

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; sub: string }[] = [
  { value: 'self',    label: 'I will deliver myself',       sub: 'Drop directly at the aid station / hub' },
  { value: 'pickup',  label: 'Arrange organizer pickup',    sub: 'Request the relief coordinator to collect supplies from you' },
  { value: 'courier', label: 'I will ship via courier',     sub: 'Provide shipment tracking details post submission' },
]

export function MakeOfferSheet({ request, isOpen, onClose }: MakeOfferSheetProps) {
  const { user } = useAuth()
  const createOffer = useCreateOffer()
  const { data: stats = [], refetch: refetchStats } = useRequestItemStats(request.id)

  const [selectedItem, setSelectedItem] = useState<SupplyItem | undefined>(request.items[0])
  const [overrideRemaining, setOverrideRemaining] = useState<Record<string, number>>({})
  const [isRefetchingStats, setIsRefetchingStats] = useState(false)

  // Calculate fresh remaining quantity
  const selectedStat = selectedItem
    ? stats.find(s => s.request_item_id === selectedItem.id)
    : undefined

  const baseRemaining = selectedItem
    ? (overrideRemaining[selectedItem.id] !== undefined
        ? overrideRemaining[selectedItem.id]
        : selectedStat !== undefined
        ? selectedStat.quantity_remaining
        : Math.max(0, selectedItem.quantityRequested - selectedItem.quantityCommitted))
    : 100

  const maxQty = Math.max(0, baseRemaining)

  const [qty, setQty] = useState(Math.min(40, maxQty > 0 ? maxQty : 1))
  const [delivery, setDelivery] = useState<DeliveryMethod>('self')
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qtyError, setQtyError] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVariant, setToastVariant] = useState<'success' | 'warning' | 'danger'>('warning')

  // Fulfilment & Pickup Form State
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const [pickupDate, setPickupDate] = useState(tomorrow)
  const [pickupTimeWindow, setPickupTimeWindow] = useState('Morning (9 AM - 12 PM)')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupContact, setPickupContact] = useState('')
  const [pickupNotes, setPickupNotes] = useState('')
  const [allowCalls, setAllowCalls] = useState(true)
  const [pickupErrors, setPickupErrors] = useState<{ address?: string; contact?: string }>({})

  // Snapshot of submitted commitment to prevent state overwrites
  const [submittedOffer, setSubmittedOffer] = useState<{
    quantity: number
    unit: string
    itemName: string
    deliveryMethod: DeliveryMethod
    pickupDate?: string
    pickupTimeWindow?: string
    pickupAddress?: string
  } | null>(null)

  const showToast = (msg: string, variant: 'success' | 'warning' | 'danger' = 'warning') => {
    setToastMessage(msg)
    setToastVariant(variant)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  const isExceeding = qty > maxQty

  // Ref to track if modal was already opened, preventing query invalidation from resetting user input or success view
  const prevIsOpenRef = useRef(false)
  const userEnteredQtyRef = useRef(false)

  // Reset state ONLY when sheet transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      prevIsOpenRef.current = true
      userEnteredQtyRef.current = false
      setIsRefetchingStats(true)
      const first = request.items[0]
      setSelectedItem(first)
      setDelivery('self')
      setMessage('')
      setPickupDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
      setPickupTimeWindow('Morning (9 AM - 12 PM)')
      setPickupAddress('')
      setPickupContact(user?.phone || '')
      setPickupNotes('')
      setAllowCalls(true)
      setPickupErrors({})
      setConfirmed(true)
      setSubmitted(false)
      setSubmittedOffer(null)
      setIsSubmitting(false)
      setQtyError('')
      setSubmitError(null)
      setOverrideRemaining({})
      setToastMessage(null)

      // 1. FORCE REFETCH WHEN MODAL OPENS
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['request_item_stats'] }),
        queryClient.invalidateQueries({ queryKey: ['request', request.id] }),
      ])
        .then(async () => {
          const { data: freshStats } = await refetchStats()
          // Only update selected item and default quantity if user has not already entered their own quantity!
          if (!userEnteredQtyRef.current) {
            const targetItem =
              (freshStats &&
                request.items.find(it => {
                  const s = freshStats.find((st: any) => st.request_item_id === it.id)
                  return s && s.quantity_remaining > 0
                })) ||
              request.items.find(it => (it.quantityRequested - it.quantityCommitted) > 0) ||
              request.items[0]

            if (targetItem) {
              setSelectedItem(targetItem)
              const stat = freshStats?.find((s: any) => s.request_item_id === targetItem.id)
              const freshMax = stat
                ? stat.quantity_remaining
                : Math.max(0, targetItem.quantityRequested - targetItem.quantityCommitted)
              setQty(freshMax > 0 ? Math.min(20, freshMax) : 0)
            }
          }
        })
        .finally(() => {
          setIsRefetchingStats(false)
        })
    } else if (!isOpen) {
      prevIsOpenRef.current = false
      userEnteredQtyRef.current = false
    }
  }, [isOpen, request.id, refetchStats, request.items])

  const handleSelectItem = (item: SupplyItem) => {
    setSelectedItem(item)
    const itemStat = stats.find(s => s.request_item_id === item.id)
    const remaining = overrideRemaining[item.id] !== undefined
      ? overrideRemaining[item.id]
      : itemStat !== undefined
      ? itemStat.quantity_remaining
      : Math.max(0, item.quantityRequested - item.quantityCommitted)
    const safeMax = Math.max(0, remaining)
    const defaultQty = safeMax > 0 ? Math.min(20, safeMax) : 0
    setQty(defaultQty)
    setQtyError('')
    setSubmitError(null)
  }

  const changeQty = (delta: number) => {
    userEnteredQtyRef.current = true
    const next = qty + delta
    if (next < 1) {
      setQtyError('Minimum is 1')
      return
    }
    if (next > maxQty) {
      setQtyError(`Exceeds remaining (${maxQty}). Adjust your quantity.`)
      setQty(next)
      return
    }
    setQtyError('')
    setQty(next)
  }

  const handleSubmit = async () => {
    userEnteredQtyRef.current = true
    if (!confirmed) {
      setQtyError('Please confirm your commitment first')
      return
    }
    if (!selectedItem) return

    if (isExceeding) {
      setQtyError(`Exceeds remaining (${maxQty}). Adjust your quantity.`)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setPickupErrors({})

    const finalQty = Number(qty)

    // Validate pickup arrangement if selected
    if (delivery === 'pickup') {
      const pErrors: { address?: string; contact?: string } = {}
      if (!pickupAddress.trim()) {
        pErrors.address = 'Please enter collection point / address'
      }
      if (!pickupContact.trim()) {
        pErrors.contact = 'Please enter donor contact phone'
      }
      if (Object.keys(pErrors).length > 0) {
        setPickupErrors(pErrors)
        setIsSubmitting(false)
        return
      }
    }

    try {
      const isValidUUID = (str: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

      // Call Supabase RPC create_offer if configured and both request and item are valid UUIDs
      if (isSupabaseConfigured && isValidUUID(request.id) && isValidUUID(selectedItem.id)) {
        // Ensure active session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          const { error: anonError } = await supabase.auth.signInAnonymously()
          if (anonError) throw new Error('Anonymous sign-in failed: ' + anonError.message)
        }

        // Try updated RPC with pickup parameters first
        let rpcError: any = null
        try {
          const res = await supabase.rpc('create_offer', {
            p_item_id: selectedItem.id,
            p_qty: finalQty,
            p_msg: message || null,
            p_delivery_method: delivery,
            p_pickup_date: delivery === 'pickup' ? pickupDate : null,
            p_pickup_time: delivery === 'pickup' ? pickupTimeWindow : null,
            p_pickup_address: delivery === 'pickup' ? pickupAddress.trim() : null,
            p_pickup_contact: delivery === 'pickup' ? pickupContact.trim() : null,
            p_pickup_notes: delivery === 'pickup' ? (pickupNotes.trim() || null) : null,
          })
          rpcError = res.error
        } catch {
          rpcError = { message: 'RPC signature mismatch' }
        }

        // If migration 008 is not yet executed remotely, gracefully fallback to 3-parameter RPC
        if (rpcError) {
          const { error: fallbackError } = await supabase.rpc('create_offer', {
            p_item_id: selectedItem.id,
            p_qty: finalQty,
            p_msg: message || null,
          })
          if (fallbackError) {
            throw new Error(fallbackError.message || 'Failed to submit offer via Supabase')
          }
        }

        // Invalidate queries so stats and request metrics refresh immediately
        queryClient.invalidateQueries({ queryKey: ['request_item_stats'] })
        queryClient.invalidateQueries({ queryKey: ['request', request.id] })
        queryClient.invalidateQueries({ queryKey: ['requests'] })
      }

      // Record in local mock store for reliable fallback and testing
      addMockOffer({
        id: `offer-${Date.now()}`,
        request_id: request.id,
        request_item_id: selectedItem.id,
        donor_id: user?.id ?? 'anon-donor',
        donor_name: user?.name ?? 'Volunteer',
        item_name: selectedItem.name,
        unit: selectedItem.unit,
        quantity_offered: finalQty,
        quantity_dispatched: 0,
        quantity_delivered: 0,
        status: 'pending',
        delivery_method: delivery,
        pickup_date: delivery === 'pickup' ? pickupDate : undefined,
        pickup_time_window: delivery === 'pickup' ? pickupTimeWindow : undefined,
        pickup_address: delivery === 'pickup' ? pickupAddress.trim() : undefined,
        pickup_contact: delivery === 'pickup' ? pickupContact.trim() : undefined,
        pickup_notes: delivery === 'pickup' ? pickupNotes.trim() : undefined,
        pickup_status: delivery === 'pickup' ? 'pending' : 'not_applicable',
        allow_calls: allowCalls,
        message: message || undefined,
        created_at: new Date().toISOString(),
      })

      // Also trigger mutation to update local React Query cache
      await createOffer.mutateAsync({
        requestId: request.id,
        requestTitle: request.title,
        donorId: user?.id ?? 'anon-donor',
        donorName: user?.name ?? 'Volunteer',
        itemName: selectedItem.name,
        unit: selectedItem.unit,
        quantityOffered: finalQty,
        deliveryMethod: delivery,
        pickupDate: delivery === 'pickup' ? pickupDate : undefined,
        pickupTimeWindow: delivery === 'pickup' ? pickupTimeWindow : undefined,
        pickupAddress: delivery === 'pickup' ? pickupAddress.trim() : undefined,
        pickupContact: delivery === 'pickup' ? pickupContact.trim() : undefined,
        pickupNotes: delivery === 'pickup' ? pickupNotes.trim() : undefined,
        pickupStatus: delivery === 'pickup' ? 'pending' : 'not_applicable',
        allow_calls: allowCalls,
        earliestDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        message,
      })

      // Add in-app confirmation notification for donor
      addNotification({
        type: 'offer_received',
        title: 'Offer Submitted',
        body: `Your commitment of ${finalQty} ${selectedItem.unit} for "${request.title}" has been recorded.${delivery === 'pickup' ? ' (Pickup requested)' : ''}`,
        relatedRequestId: request.id,
      })

      // Invalidate again to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['request_item_stats'] })
      queryClient.invalidateQueries({ queryKey: ['request', request.id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['request_offers', request.id] })

      // Dispatch real-time push notification to the requester
      if (request.requesterId) {
        triggerRemotePush({
          event: 'offer_created',
          recipientUserId: request.requesterId,
          title: 'New Supply Offer Received',
          body: `A donor offered ${finalQty} ${selectedItem.unit} of "${selectedItem.name}" for "${request.title}".`,
          url: `/requests/${request.id}`,
          tag: `relieflink-offer-${request.id}`,
          idempotencyKey: `client-offer-${request.id}-${selectedItem.id}-${finalQty}`,
        }).catch(() => {})
      }

      // Persist snapshot of successfully saved commitment
      setSubmittedOffer({
        quantity: finalQty,
        unit: selectedItem.unit,
        itemName: selectedItem.name,
        deliveryMethod: delivery,
        pickupDate: delivery === 'pickup' ? pickupDate : undefined,
        pickupTimeWindow: delivery === 'pickup' ? pickupTimeWindow : undefined,
        pickupAddress: delivery === 'pickup' ? pickupAddress.trim() : undefined,
      })
      setSubmitted(true)
    } catch (err: any) {
      const errorMsg = err?.message || ''
      if (errorMsg.includes('EXCEEDS_REMAINING')) {
        const parts = errorMsg.split(':')
        const remainingVal = parts.length > 1 ? parseFloat(parts[1].trim()) : 0
        const safeRemaining = isNaN(remainingVal) ? 0 : remainingVal

        if (selectedItem) {
          setOverrideRemaining(prev => ({
            ...prev,
            [selectedItem.id]: safeRemaining,
          }))
        }

        const exceedMsg = `Only ${safeRemaining} remaining. Adjust your quantity.`
        setSubmitError(exceedMsg)
        setQtyError(exceedMsg)

        if (qty > safeRemaining) {
          setQty(safeRemaining > 0 ? safeRemaining : 0)
        }

        queryClient.invalidateQueries({ queryKey: ['request_item_stats'] })
        queryClient.invalidateQueries({ queryKey: ['request', request.id] })
        refetchStats()
      } else {
        setSubmitError(errorMsg || 'Failed to submit offer')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const committed = selectedStat ? selectedStat.quantity_committed : selectedItem?.quantityCommitted || 0
  const requested = selectedStat ? selectedStat.quantity_needed : selectedItem?.quantityRequested || 0
  const ratio = requested > 0 ? fulfillmentRatio(committed, requested) : 0

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40 bg-navy-900/75 transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label="Make an offer"
        className="fixed bottom-0 inset-x-0 z-50 bg-surface rounded-t-[24px] shadow-sheet"
      >
        {/* Drag handle */}
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Scrollable content */}
        <div className="px-5 pt-1 pb-32 flex flex-col gap-5 overflow-y-auto max-h-[85dvh]">
          {submitted ? (
            /* ── Success state ─────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <div className="space-y-2">
                <h2 className="text-h2 font-semibold text-ink">Offer submitted!</h2>
                <p className="text-body text-ink leading-relaxed">
                  Your commitment of{' '}
                  <strong className="text-brand-600 font-bold">
                    {fmtNumber(submittedOffer?.quantity ?? qty)} {submittedOffer?.unit ?? selectedItem?.unit}
                  </strong>{' '}
                  has been recorded.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-card p-3 text-caption text-ink-muted text-left space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">Fulfilment Method:</span>
                    <span className="capitalize font-medium text-navy-900">
                      {submittedOffer?.deliveryMethod === 'pickup'
                        ? 'Organizer Pickup'
                        : submittedOffer?.deliveryMethod === 'courier'
                        ? 'Courier Shipment'
                        : 'Self Delivery'}
                    </span>
                  </div>
                  {submittedOffer?.deliveryMethod === 'pickup' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span>Pickup Date:</span>
                        <span className="text-ink font-medium">{submittedOffer.pickupDate} ({submittedOffer.pickupTimeWindow})</span>
                      </div>
                      <div className="flex items-start justify-between gap-2 pt-0.5">
                        <span className="shrink-0">Location:</span>
                        <span className="text-ink font-medium text-right truncate">{submittedOffer.pickupAddress}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <Button variant="primary" onClick={onClose} className="w-full max-w-xs mt-2">
                Done
              </Button>
            </div>
          ) : (
            <>
              {/* ── Header ─────────────────────────────────────────── */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-h2 font-semibold text-ink tracking-tight">Offer supplies</h1>
                  <p className="text-caption text-ink-muted mt-0.5">
                    {selectedItem?.name} · {request.refNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-10 h-10 -mr-1 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-slate-100 active:scale-95 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {submitError && (
                <div className="bg-danger-bg border border-red-200 rounded-card p-3 flex items-start gap-2 text-caption text-danger font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* ── 1. Item Selector ───────────────────────────────── */}
              {request.items && request.items.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-caption font-semibold text-ink">
                    Select item to provide
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {request.items.map(item => {
                      const isSelected = selectedItem?.id === item.id
                      const itemStat = stats.find(s => s.request_item_id === item.id)
                      const remainingNeeded = Math.max(
                        0,
                        overrideRemaining[item.id] !== undefined
                          ? overrideRemaining[item.id]
                          : itemStat !== undefined
                          ? itemStat.quantity_remaining
                          : item.quantityRequested - item.quantityCommitted,
                      )
                      return (
                        <Card
                          key={item.id}
                          as="div"
                          noPadding
                          onClick={() => handleSelectItem(item)}
                          className={cn(
                            'p-3 rounded-card border transition-all cursor-pointer flex items-center justify-between',
                            isSelected
                              ? 'bg-brand-100 border-brand-600 ring-1 ring-brand-600/30'
                              : 'bg-surface border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                          )}
                        >
                          <div className="flex flex-col">
                            <span
                              className={cn(
                                'text-body font-semibold',
                                isSelected ? 'text-navy-900' : 'text-ink',
                              )}
                            >
                              {item.name}
                            </span>
                            <span
                              className={cn(
                                'text-caption',
                                isSelected ? 'text-brand-700 font-medium' : 'text-ink-muted',
                              )}
                            >
                              {fmtNumber(remainingNeeded)} {item.unit} needed
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-brand-600 shrink-0" />
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── 2. Item status card ─────────────────────────────── */}
              {selectedItem && (
                <div className="bg-bg-app border border-slate-200 rounded-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-body font-semibold text-ink">
                      {selectedItem.name} — {fmtNumber(requested)} {selectedItem.unit}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-100 text-brand-600">
                      {fmtPercent(committed, requested)} met
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-caption text-ink-muted tnum">
                    <span>{fmtNumber(committed)} committed</span>
                    <span>{fmtNumber(maxQty)} remaining</span>
                  </div>
                  <div className="pt-1 border-t border-slate-200 flex items-center gap-1.5 text-caption font-medium text-success">
                    <CheckCircle className="w-4 h-4" />
                    <span>{fmtNumber(maxQty)} {selectedItem.unit} still needed</span>
                  </div>
                </div>
              )}


              {/* ── 3. Quantity stepper ──────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <label className="text-h4 font-semibold text-ink">
                  How many {selectedItem?.unit} can you provide?
                </label>
                <div className="bg-surface border border-slate-200 rounded-card p-4 flex flex-col items-center gap-3 shadow-card">
                  <div className="flex items-center justify-center gap-6 w-full">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => changeQty(-1)}
                      className="w-12 h-12 rounded-full border border-slate-300 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-ink transition-colors focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center min-w-[120px]">
                      <input
                        type="number"
                        id="offer-qty-input"
                        aria-label="Quantity to provide"
                        min="1"
                        max={maxQty}
                        value={qty || ''}
                        onChange={e => {
                          userEnteredQtyRef.current = true
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val)) {
                            setQty(Math.min(maxQty, Math.max(1, val)))
                            setQtyError('')
                          } else if (e.target.value === '') {
                            setQty(0)
                          }
                        }}
                        className="text-[36px] leading-none font-bold text-ink tracking-tight tnum w-28 text-center bg-transparent border-b border-slate-200 hover:border-slate-300 focus:border-brand-600 outline-none transition-colors"
                      />
                      <span className="text-caption text-ink-muted mt-1 uppercase tracking-wider">
                        {selectedItem?.unit ?? 'Units'}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => changeQty(+1)}
                      className="w-12 h-12 rounded-full bg-brand-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-navy-900 cursor-pointer"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick-pick chips */}
                  <div className="w-full flex items-center justify-between gap-1.5 pt-2">
                    {[10, 25, 50]
                      .filter(n => n <= maxQty)
                      .map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            userEnteredQtyRef.current = true
                            setQty(n)
                            setQtyError('')
                          }}
                          className={cn(
                            'flex-1 h-9 rounded-pill border border-slate-300 bg-surface text-caption font-semibold text-ink hover:bg-slate-50 transition-colors cursor-pointer',
                            qty === n && 'border-brand-600 bg-brand-100 text-brand-600',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => {
                        userEnteredQtyRef.current = true
                        setQty(maxQty)
                        setQtyError('')
                      }}
                      className={cn(
                        'flex-[1.6] h-9 rounded-pill border border-brand-600 bg-brand-100 text-caption font-semibold text-brand-600 transition-colors cursor-pointer',
                        qty === maxQty && 'ring-2 ring-brand-600/30 font-bold',
                      )}
                    >
                      {maxQty} (Max)
                    </button>
                  </div>
                </div>
                {isExceeding ? (
                  <div className="bg-danger-bg border border-red-200 rounded-input p-2.5 flex items-center gap-2 text-caption text-danger font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-danger" />
                    <span>Exceeds remaining ({maxQty}). Adjust your quantity.</span>
                  </div>
                ) : qtyError ? (
                  <div className="bg-danger-bg border border-red-200 rounded-input p-2.5 flex items-center gap-2 text-caption text-danger font-medium">
                    <X className="w-4 h-4 shrink-0" />
                    <span>{qtyError}</span>
                  </div>
                ) : null}

              </div>

              {/* ── 4. Delivery method ───────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <label className="text-h4 font-semibold text-ink">Delivery method</label>
                <div className="flex flex-col gap-2">
                  {DELIVERY_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-input border-2 cursor-pointer min-h-touch transition-colors',
                        delivery === opt.value
                          ? 'border-brand-600 bg-brand-100/30'
                          : 'border-slate-200 bg-surface hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="radio"
                        name="delivery_method"
                        value={opt.value}
                        checked={delivery === opt.value}
                        onChange={() => {
                          setDelivery(opt.value)
                          setPickupErrors({})
                        }}
                        className="w-4 h-4 text-brand-600 accent-brand-600"
                      />
                      <div className="flex flex-col">
                        <span className="text-body font-semibold text-ink">{opt.label}</span>
                        <span className="text-caption text-ink-muted">{opt.sub}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* ── Pickup Details Sub-form ── */}
                {delivery === 'pickup' && (
                  <div className="bg-brand-50/70 border border-brand-200 rounded-card p-4 space-y-3 mt-1 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-body font-semibold text-navy-900 leading-tight">Pickup Arrangement Details</h4>
                        <p className="text-[12px] text-ink-muted">The relief team will coordinate pickup from this location</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[12px] font-semibold text-ink block mb-1">Proposed Pickup Date</label>
                        <Input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={pickupDate}
                          onChange={e => setPickupDate(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold text-ink block mb-1">Time Window</label>
                        <select
                          value={pickupTimeWindow}
                          onChange={e => setPickupTimeWindow(e.target.value)}
                          className="w-full h-11 px-3 rounded-input border border-slate-300 bg-surface text-body font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand-600"
                        >
                          <option value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</option>
                          <option value="Afternoon (12 PM - 4 PM)">Afternoon (12 PM - 4 PM)</option>
                          <option value="Evening (4 PM - 8 PM)">Evening (4 PM - 8 PM)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Input
                        label="Pickup Address / Collection Point"
                        placeholder="e.g. 102 Green Heights, M.G. Road, Pune"
                        value={pickupAddress}
                        onChange={e => {
                          setPickupAddress(e.target.value)
                          if (pickupErrors.address) setPickupErrors(p => ({ ...p, address: undefined }))
                        }}
                        error={pickupErrors.address}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-caption font-semibold text-ink">
                          Donor Contact Phone *
                        </label>
                        {user?.phone && pickupContact === user.phone && (
                          <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-pill">
                            Prefilled from profile
                          </span>
                        )}
                      </div>
                      <Input
                        placeholder="+91 98765 43210"
                        type="tel"
                        value={pickupContact}
                        onChange={e => {
                          setPickupContact(e.target.value)
                          if (pickupErrors.contact) setPickupErrors(p => ({ ...p, contact: undefined }))
                        }}
                        error={pickupErrors.contact}
                        required
                      />

                      {/* Owner-controlled call button toggle for donor */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80 mt-1">
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            {allowCalls ? (
                              <Phone className="w-3.5 h-3.5 text-brand-600" />
                            ) : (
                              <PhoneOff className="w-3.5 h-3.5 text-ink-muted" />
                            )}
                            <span className="text-body font-semibold text-navy-900">
                              Allow Coordinator to Call
                            </span>
                          </div>
                          <p className="text-[12px] text-ink-muted leading-relaxed">
                            {allowCalls
                              ? 'Coordinator can tap "Call Donor" to coordinate pickup arrival. Your raw digits are protected.'
                              : 'Call button will be hidden. Coordinator will follow written pickup notes.'}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          id="offer-allow-calls-toggle"
                          checked={allowCalls}
                          onChange={e => setAllowCalls(e.target.checked)}
                          className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-600 cursor-pointer shrink-0"
                        />
                      </div>
                    </div>

                    <div>
                      <Textarea
                        label="Pickup Instructions / Notes (optional)"
                        placeholder="e.g. Supplies packaged in 2 boxes, please call upon arrival."
                        rows={2}
                        value={pickupNotes}
                        onChange={e => setPickupNotes(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── 5. Message ───────────────────────────────────────── */}
              <Textarea
                label="Message (optional)"
                placeholder="Add delivery instructions, brand, or vehicle details…"
                rows={2}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />

              {/* ── 6. Confirmation checkbox ─────────────────────────── */}
              <label className="flex items-start gap-3 p-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-slate-300 accent-brand-600"
                />
                <span className="text-caption text-ink leading-snug">
                  I confirm this is an active commitment and not a duplicate response to this crisis alert.
                </span>
              </label>

              {/* ── 7. Info callout ──────────────────────────────────── */}
              <div className="bg-info-bg/80 border border-blue-200 rounded-card p-3 flex items-start gap-2.5">
                <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
                <p className="text-caption text-navy-700 leading-relaxed">
                  Your offer will be held for the requester. Quantities count toward fulfillment once verified at delivery check-in.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Sticky bottom actions ─────────────────────────────────── */}
        {!submitted && (
          <div className="absolute bottom-0 left-0 right-0 bg-surface border-t border-slate-200 p-4 pb-safe flex flex-col gap-2 shadow-lg">
            {isExceeding && (
              <p className="text-caption text-danger font-medium text-center">
                Exceeds remaining ({maxQty}). Adjust your quantity.
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="w-[35%]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                isLoading={isSubmitting || createOffer.isPending || isRefetchingStats}
                disabled={!confirmed || qty < 1 || isExceeding || isRefetchingStats}
                className="w-[65%]"
              >
                {isRefetchingStats ? 'Checking stock…' : 'Submit offer'}
              </Button>
            </div>
          </div>
        )}

      </div>


      {/* Toast notification */}
      <Toast
        message={toastMessage}
        visible={Boolean(toastMessage)}
        variant={toastVariant}
      />
    </>
  )
}
