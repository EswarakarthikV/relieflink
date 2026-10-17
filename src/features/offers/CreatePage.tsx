import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { TitleEnhancer } from '@/components/TitleEnhancer'
import { DescriptionEnhancer } from '@/components/DescriptionEnhancer'
import { AlertTriangle, MapPin, Package, Plus, X, Navigation, Map, Lock } from 'lucide-react'
import type { UrgencyLevel } from '@/types'
import { cn } from '@/utils/cn'
import { urgencyLabel, urgencyBadgeClasses } from '@/utils/urgency'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { LocationPickerModal, reverseGeocodeNominatim } from '@/components/LocationPickerModal'
import { Toast } from '@/components/ui/Toast'
import { triggerRemotePush } from '@/lib/pushNotifications'

const URGENCY_OPTIONS: UrgencyLevel[] = ['low', 'medium', 'high', 'critical']
const UNIT_OPTIONS = ['bottles', 'kg', 'kits', 'liters', 'packets', 'units']
const CATEGORY_OPTIONS = ['Water', 'Food', 'Hygiene', 'Medical', 'Shelter', 'Other']

export interface ItemRow {
  id: string
  name: string
  quantity: string
  unit: string
  category: string
}

const createInitialItem = (): ItemRow => ({
  id: Math.random().toString(36).substring(2, 9),
  name: '',
  quantity: '',
  unit: 'bottles',
  category: 'Water',
})

interface FormState {
  title: string
  description: string
  location: string
  urgency: UrgencyLevel
  items: ItemRow[]
  contact_name: string
  contact_phone: string
  latitude?: number
  longitude?: number
}

const INITIAL_FORM: FormState = {
  title: '',
  description: '',
  location: '',
  urgency: 'medium',
  items: [createInitialItem()],
  contact_name: '',
  contact_phone: '',
}

export function CreatePage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [errors, setErrors] = useState<{
    title?: string
    location?: string
    contact_name?: string
    contact_phone?: string
  }>({})
  const [itemErrors, setItemErrors] = useState<Record<string, { name?: string; quantity?: string }>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastVariant, setToastVariant] = useState<'success' | 'warning'>('success')

  const showToast = (msg: string, variant: 'success' | 'warning' = 'success') => {
    setToastMessage(msg)
    setToastVariant(variant)
    setToastVisible(true)
    setTimeout(() => {
      setToastVisible(false)
    }, 4000)
  }


  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const updateItem = (id: string, field: keyof ItemRow, value: string) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item => (item.id === id ? { ...item, [field]: value } : item)),
    }))
    // Clear item error when user types
    if (itemErrors[id]) {
      setItemErrors(prev => {
        const next = { ...prev }
        delete next[id]?.[field as 'name' | 'quantity']
        return next
      })
    }
  }

  const addItem = () => {
    if (form.items.length >= 10) return
    setForm(prev => ({
      ...prev,
      items: [...prev.items, createInitialItem()],
    }))
  }

  const removeItem = (id: string) => {
    if (form.items.length <= 1) return
    setForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }))
    setItemErrors(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const validate = (): boolean => {
    const e: {
      title?: string
      location?: string
      contact_name?: string
      contact_phone?: string
    } = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.location.trim()) e.location = 'Location is required'
    if (!form.contact_name.trim()) e.contact_name = 'Contact name is required'
    if (!form.contact_phone.trim()) {
      e.contact_phone = 'Contact phone is required'
    } else {
      const cleanDigits = form.contact_phone.replace(/\D/g, '')
      if (cleanDigits.length < 7) {
        e.contact_phone = 'Please enter a valid numeric phone number'
      }
    }
    setErrors(e)

    const rowErrors: Record<string, { name?: string; quantity?: string }> = {}
    let itemsValid = true

    form.items.forEach(item => {
      const rowErr: { name?: string; quantity?: string } = {}
      if (!item.name.trim()) {
        rowErr.name = 'Item name is required'
        itemsValid = false
      }
      const qty = Number(item.quantity)
      if (!item.quantity || isNaN(qty) || qty <= 0) {
        rowErr.quantity = 'Quantity must be ≥ 1'
        itemsValid = false
      }
      if (Object.keys(rowErr).length > 0) {
        rowErrors[item.id] = rowErr
      }
    })

    setItemErrors(rowErrors)
    return Object.keys(e).length === 0 && itemsValid
  }

  const handleUseCurrentLocation = () => {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError("Location access denied. Tap 'Pick on map' instead.")
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const address = await reverseGeocodeNominatim(lat, lng, true)
          setField('location', address)
          setField('latitude', lat)
          setField('longitude', lng)
          setLocationError(null)
          if (errors.location) {
            setErrors(prev => ({ ...prev, location: undefined }))
          }
        } catch {
          // If reverse geocoding fails: still save lat/lng to form state, and show a warning toast: "Coordinates saved. Please type the address manually."
          setField('latitude', lat)
          setField('longitude', lng)
          showToast('Coordinates saved. Please type the address manually.', 'warning')
        } finally {
          setIsLocating(false)
        }
      },
      (err) => {
        setIsLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("Location access denied. Tap 'Pick on map' instead.")
        } else {
          setLocationError("Location access denied. Tap 'Pick on map' instead.")
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleMapConfirm = (address: string, lat: number, lng: number) => {
    setField('location', address)
    setField('latitude', lat)
    setField('longitude', lng)
    setLocationError(null)
    if (errors.location) {
      setErrors(prev => ({ ...prev, location: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setIsSubmitting(true)
    let createdRequestId: string | null = null

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // try one more time to sign in anonymously
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw new Error('Anonymous sign-in failed: ' + error.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Step 1: Insert ONE row into requests with requester_id: user.id
      const { data: reqData, error: reqError } = await supabase
        .from('requests')
        .insert([{
          requester_id: user.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          urgency: form.urgency,
          status: 'open',
          city: form.location.trim(),
          address_line: form.location.trim(),
          latitude: form.latitude ?? null,
          longitude: form.longitude ?? null,
        }])
        .select('id')
        .single()

      if (reqError) {
        throw new Error(reqError.message || 'Failed to create request in database')
      }

        createdRequestId = reqData.id

        // Step 2: Insert N rows into request_items
        const itemsPayload = form.items.map(item => ({
          request_id: createdRequestId,
          item_name: item.name.trim(),
          category: item.category.toLowerCase(),
          unit: item.unit.toLowerCase(),
          quantity_needed: Number(item.quantity),
        }))

        const { error: itemsError } = await supabase
          .from('request_items')
          .insert(itemsPayload)

        if (itemsError) {
          // Rollback on error: delete the created request
          await supabase.from('requests').delete().eq('id', createdRequestId)
          throw new Error(itemsError.message || 'Failed to save request items')
        }

        // Step 3: Insert into request_contacts
        const { error: contactError } = await supabase
          .from('request_contacts')
          .insert([{
            request_id: createdRequestId,
            contact_name: form.contact_name.trim(),
            contact_phone: form.contact_phone.trim(),
          }])

        if (contactError) {
          // Rollback on error: delete the created request
          await supabase.from('requests').delete().eq('id', createdRequestId)
          throw new Error(contactError.message || 'Failed to save contact information')
        }

        // Invalidate cached requests so Browse, Home, and My Requests show updated items immediately
        queryClient.invalidateQueries({ queryKey: ['requests'] })
        queryClient.invalidateQueries({ queryKey: ['my_requests'] })
        queryClient.invalidateQueries({ queryKey: ['request_contact'] })

        // Automatically dispatch push alert to subscribers if high or critical urgency
        if (createdRequestId && (form.urgency === 'critical' || form.urgency === 'high')) {
          triggerRemotePush({
            event: 'critical_request',
            recipientUserId: null,
            title: form.urgency === 'critical'
              ? `🚨 Critical Relief Needed: ${form.location.trim() || 'Emergency Area'}`
              : `⚠️ Urgent Relief Needed: ${form.location.trim() || 'Emergency Area'}`,
            body: form.title.trim(),
            url: `/requests/${createdRequestId}`,
            tag: `relieflink-request-${createdRequestId}`,
            idempotencyKey: `client-req-${createdRequestId}`,
          }).catch(() => {})
        }

        setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <AppShell>
      <TopBar title="Create Request" showBack variant="navy" />

      <div className="pt-16 px-4 pb-6">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
              <Package className="w-8 h-8 text-success" />
            </div>
            <div>
              <h2 className="text-h2 font-semibold text-ink mb-1">Request submitted!</h2>
              <p className="text-caption text-ink-muted">
                Your supply request with {form.items.length} item{form.items.length !== 1 ? 's' : ''} has been posted to the ReliefLink network.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setForm(INITIAL_FORM)
                  setSubmitted(false)
                }}
              >
                Create another
              </Button>
              <Link to="/browse" className="w-full">
                <Button variant="primary" fullWidth>
                  View on Browse
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
            {submitError && (
              <div className="bg-danger-bg border border-red-200 rounded-card p-3 text-caption text-danger flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Urgency selector */}
            <div className="flex flex-col gap-2">
              <label className="text-caption font-semibold text-ink">Urgency level</label>
              <div className="flex gap-2 flex-wrap">
                {URGENCY_OPTIONS.map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setField('urgency', u)}
                    className={cn(
                      'px-3 py-1.5 rounded-pill border text-caption font-medium transition-all',
                      form.urgency === u
                        ? urgencyBadgeClasses[u] + ' font-semibold'
                        : 'bg-surface-high text-on-surface-muted border-slate-200',
                    )}
                  >
                    {urgencyLabel[u]}
                  </button>
                ))}
              </div>
            </div>

            {/* Title with AI enhancement */}
            <TitleEnhancer
              value={form.title}
              onChange={v => setField('title', v)}
              description={form.description}
              category={form.items.map(i => i.category).join(', ') || 'General'}
              error={errors.title}
            />

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Textarea
                label="Description"
                placeholder="Add context: affected population, health risk, deadline…"
                rows={3}
                value={form.description}
                onChange={e => setField('description', e.target.value)}
              />
              <DescriptionEnhancer
                description={form.description}
                onApply={v => setField('description', v)}
                title={form.title}
                category={form.items.map(i => i.category).join(', ') || 'General'}
              />
            </div>

            {/* Location */}
            <div className="flex flex-col gap-2">
              <Input
                label="Location *"
                placeholder="e.g. Kothrud, Pune"
                value={form.location}
                onChange={e => {
                  setField('location', e.target.value)
                  if (locationError) setLocationError(null)
                }}
                error={errors.location}
                leftIcon={<MapPin className="w-4 h-4" />}
              />

              {/* Location helper buttons */}
              <div className="grid grid-cols-2 gap-2.5 -mt-0.5">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="h-10 px-3 rounded-input border border-slate-200 bg-surface hover:bg-slate-50 text-ink text-caption font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-[0.99] disabled:opacity-50"
                >
                  <Navigation className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="truncate">{isLocating ? 'Finding your location...' : '📍 Use my current location'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapPickerOpen(true)}
                  className="h-10 px-3 rounded-input border border-slate-200 bg-surface hover:bg-slate-50 text-ink text-caption font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-[0.99]"
                >
                  <Map className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="truncate">🗺 Pick on map</span>
                </button>
              </div>

              {locationError && (
                <p className="text-[12px] text-danger font-medium -mt-1">
                  {locationError}
                </p>
              )}
            </div>

            {/* ── Items Needed Section (Multiple Items) ────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-caption font-semibold text-ink block">
                    Items needed *
                  </label>
                  <p className="text-[12px] text-ink-muted">
                    List each required supply item ({form.items.length}/10)
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {form.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-surface rounded-input border border-slate-200 p-3 flex flex-col gap-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-ink-muted">
                        Item #{index + 1}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove item ${index + 1}`}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-danger hover:bg-red-50 transition-colors -mr-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <Input
                      label="Item name *"
                      placeholder="e.g. Drinking water"
                      value={item.name}
                      onChange={e => updateItem(item.id, 'name', e.target.value)}
                      error={itemErrors[item.id]?.name}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Quantity *"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        placeholder="e.g. 200"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        error={itemErrors[item.id]?.quantity}
                      />
                      <Select
                        label="Unit *"
                        value={item.unit}
                        onChange={e => updateItem(item.id, 'unit', e.target.value)}
                      >
                        {UNIT_OPTIONS.map(unit => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <Select
                      label="Category *"
                      value={item.category}
                      onChange={e => updateItem(item.id, 'category', e.target.value)}
                    >
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>

              {form.items.length < 10 && (
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 text-caption font-semibold text-brand-600 hover:text-blue-700 active:text-blue-800 transition-colors self-start py-1 cursor-pointer select-none"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add another item</span>
                </button>
              )}
            </div>

            {/* ── Private Contact Section ────────────────────────── */}
            <div className="bg-surface rounded-card border border-slate-200/80 p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-caption font-semibold text-ink">
                    Private Contact
                  </h3>
                  <p className="text-[12px] text-ink-muted leading-relaxed">
                    Coordinator contact details are private. Only visible to verified donors with active delivery offers.
                  </p>
                </div>
              </div>

              <Input
                label="Contact name *"
                placeholder="e.g. Ramesh Kumar"
                value={form.contact_name}
                onChange={e => {
                  setField('contact_name', e.target.value)
                  if (errors.contact_name) setErrors(prev => ({ ...prev, contact_name: undefined }))
                }}
                error={errors.contact_name}
              />

              <Input
                label="Contact phone *"
                type="tel"
                inputMode="numeric"
                placeholder="e.g. 9876543210"
                value={form.contact_phone}
                onChange={e => {
                  const val = e.target.value.replace(/[^\d+ -]/g, '')
                  setField('contact_phone', val)
                  if (errors.contact_phone) setErrors(prev => ({ ...prev, contact_phone: undefined }))
                }}
                error={errors.contact_phone}
              />
            </div>

            {/* Critical warning */}
            {form.urgency === 'critical' && (
              <div className="bg-danger-bg border border-red-200 rounded-card p-3 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                <p className="text-caption text-danger leading-relaxed">
                  Marking as Critical triggers immediate alerts to all nearby donors. Use only for life-threatening situations.
                </p>
              </div>
            )}


            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isSubmitting}
            >
              Submit Request
            </Button>
          </form>
        )}

        <LocationPickerModal
          isOpen={mapPickerOpen}
          onClose={() => setMapPickerOpen(false)}
          onConfirm={handleMapConfirm}
          initialLat={form.latitude}
          initialLng={form.longitude}
        />

        <Toast
          message={toastMessage}
          visible={toastVisible}
          variant={toastVariant}
        />
      </div>
    </AppShell>
  )
}
