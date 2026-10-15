import { useState, useEffect } from 'react'
import { X, Minus, Plus, Info, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { useCreateOffer } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { fmtNumber, fmtPercent, fulfillmentRatio } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Request, DeliveryMethod } from '@/types'

interface MakeOfferSheetProps {
  request: Request
  isOpen: boolean
  onClose: () => void
}

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; sub: string }[] = [
  { value: 'self',    label: 'I will deliver myself',       sub: 'Drop directly at the aid station' },
  { value: 'courier', label: 'I will ship via courier',     sub: 'Provide tracking details post submission' },
  { value: 'pickup',  label: 'Requester picks up from me',  sub: 'Available for pickup within city limits' },
]

export function MakeOfferSheet({ request, isOpen, onClose }: MakeOfferSheetProps) {
  const { user } = useAuth()
  const createOffer = useCreateOffer()

  const primaryItem = request.items[0]
  const maxQty = primaryItem
    ? primaryItem.quantityRequested - primaryItem.quantityCommitted
    : 100

  const [qty,          setQty]          = useState(Math.min(40, maxQty))
  const [delivery,     setDelivery]     = useState<DeliveryMethod>('self')
  const [message,      setMessage]      = useState('')
  const [confirmed,    setConfirmed]    = useState(true)
  const [submitted,    setSubmitted]    = useState(false)
  const [qtyError,     setQtyError]     = useState('')

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setQty(Math.min(40, maxQty))
      setDelivery('self')
      setMessage('')
      setConfirmed(true)
      setSubmitted(false)
      setQtyError('')
    }
  }, [isOpen, maxQty])

  const changeQty = (delta: number) => {
    const next = qty + delta
    if (next < 1)      { setQtyError('Minimum is 1'); return }
    if (next > maxQty) { setQtyError(`Cannot exceed ${maxQty} (remaining need)`); return }
    setQtyError('')
    setQty(next)
  }

  const handleSubmit = async () => {
    if (!confirmed) { setQtyError('Please confirm your commitment first'); return }
    if (!primaryItem || !user) return
    await createOffer.mutateAsync({
      requestId:      request.id,
      requestTitle:   request.title,
      donorId:        user.id,
      donorName:      user.name,
      itemName:       primaryItem.name,
      unit:           primaryItem.unit,
      quantityOffered: qty,
      deliveryMethod: delivery,
      earliestDate:   new Date(Date.now() + 3 * 86_400_000).toISOString(),
      message,
    })
    setSubmitted(true)
  }

  if (!isOpen) return null

  const ratio = primaryItem ? fulfillmentRatio(primaryItem.quantityCommitted, primaryItem.quantityRequested) : 0

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
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <div>
                <h2 className="text-h2 font-semibold text-ink">Offer submitted!</h2>
                <p className="text-caption text-ink-muted mt-1">
                  Your commitment of {fmtNumber(qty)} {primaryItem?.unit} has been recorded.
                </p>
              </div>
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <>
              {/* ── Header ─────────────────────────────────────────── */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-h2 font-semibold text-ink tracking-tight">Offer supplies</h1>
                  <p className="text-caption text-ink-muted mt-0.5">
                    {primaryItem?.name} · {request.refNumber}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="min-h-touch min-w-[44px] flex items-center justify-center rounded-full text-ink-muted hover:bg-slate-100 active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ── Item status card ─────────────────────────────────── */}
              {primaryItem && (
                <div className="bg-bg-app border border-slate-200 rounded-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-body font-semibold text-ink">
                      {primaryItem.name} — {fmtNumber(primaryItem.quantityRequested)} {primaryItem.unit}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-100 text-brand-600">
                      {fmtPercent(primaryItem.quantityCommitted, primaryItem.quantityRequested)} met
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-brand-600 h-full rounded-full" style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-caption text-ink-muted tnum">
                    <span>{fmtNumber(primaryItem.quantityCommitted)} committed</span>
                    <span>{fmtNumber(maxQty)} remaining</span>
                  </div>
                  <div className="pt-1 border-t border-slate-200 flex items-center gap-1.5 text-caption font-medium text-success">
                    <CheckCircle className="w-4 h-4" />
                    <span>{fmtNumber(maxQty)} {primaryItem.unit} still needed</span>
                  </div>
                </div>
              )}

              {/* ── Quantity stepper ──────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <label className="text-h4 font-semibold text-ink">
                  How many {primaryItem?.unit} can you provide?
                </label>
                <div className="bg-surface border border-slate-200 rounded-card p-4 flex flex-col items-center gap-3 shadow-card">
                  <div className="flex items-center justify-center gap-6 w-full">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => changeQty(-1)}
                      className="w-12 h-12 rounded-full border border-slate-300 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-ink transition-colors focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center min-w-[120px]">
                      <span className="text-[40px] leading-none font-bold text-ink tracking-tight tnum">{qty}</span>
                      <span className="text-caption text-ink-muted mt-1 uppercase tracking-wider">
                        {primaryItem?.unit ?? 'Units'}
                      </span>
                    </div>

                    <button
                      aria-label="Increase quantity"
                      onClick={() => changeQty(+1)}
                      className="w-12 h-12 rounded-full bg-brand-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-navy-900"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick-pick chips */}
                  <div className="w-full flex items-center justify-between gap-1.5 pt-2">
                    {[10, 25, 50].map(n => (
                      <button
                        key={n}
                        onClick={() => { setQty(n); setQtyError('') }}
                        className="flex-1 h-9 rounded-pill border border-slate-300 bg-surface text-caption font-semibold text-ink hover:bg-slate-50 transition-colors"
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => { setQty(maxQty); setQtyError('') }}
                      className="flex-[1.6] h-9 rounded-pill border border-brand-600 bg-brand-100 text-caption font-semibold text-brand-600 transition-colors"
                    >
                      {maxQty} (Max)
                    </button>
                  </div>
                </div>
                {qtyError && (
                  <div className="bg-danger-bg border border-red-200 rounded-input p-2.5 flex items-center gap-2 text-caption text-danger font-medium">
                    <X className="w-4 h-4 shrink-0" />
                    {qtyError}
                  </div>
                )}
              </div>

              {/* ── Delivery method ───────────────────────────────────── */}
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
                        onChange={() => setDelivery(opt.value)}
                        className="w-4 h-4 text-brand-600 accent-brand-600"
                      />
                      <div className="flex flex-col">
                        <span className="text-body font-semibold text-ink">{opt.label}</span>
                        <span className="text-caption text-ink-muted">{opt.sub}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Message ───────────────────────────────────────────── */}
              <Textarea
                label="Message (optional)"
                placeholder="Add delivery instructions, brand, or vehicle details…"
                rows={2}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />

              {/* ── Confirmation checkbox ─────────────────────────────── */}
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

              {/* ── Info callout ──────────────────────────────────────── */}
              <div className="bg-info-bg/80 border border-blue-200 rounded-card p-3 flex items-start gap-2.5">
                <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
                <p className="text-caption text-navy-700 leading-relaxed">
                  Your offer will be held for the requester. Quantities count toward fulfillment once verified at delivery check-in.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Sticky bottom actions ─────────────────────────────────────── */}
        {!submitted && (
          <div className="absolute bottom-0 left-0 right-0 bg-surface border-t border-slate-200 p-4 pb-safe flex items-center gap-3 shadow-lg">
            <Button variant="secondary" onClick={onClose} className="w-[40%]">Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={createOffer.isPending}
              disabled={!confirmed || qty < 1}
              className="w-[60%]"
            >
              Submit offer
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
