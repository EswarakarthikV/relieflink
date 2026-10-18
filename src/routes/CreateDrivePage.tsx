import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toast } from '@/components/ui/Toast'
import { LocationPickerModal } from '@/components/LocationPickerModal'
import {
  Truck,
  MapPin,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  ShieldCheck,
  Package,
  Layers,
  ChevronDown,
  Sparkles,
  Loader2,
  ExternalLink,
  Phone,
  PhoneOff,
} from 'lucide-react'
import { useCreateDrive } from '@/hooks/useDrives'
import { useAuth } from '@/hooks/useAuth'
import type { TargetSupplyItem } from '@/types'
import { cn } from '@/utils/cn'
import { parseCollectionDrive, type AIParsedDriveResult } from '@/lib/gemini'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const VEHICLE_OPTIONS = [
  { value: 'Truck', label: 'Truck (Heavy Logistics)' },
  { value: 'Van', label: 'Tempo / Van (Medium)' },
  { value: 'Car', label: 'Car / SUV (Small)' },
  { value: 'Two-wheeler', label: 'Two-wheeler / Bike' },
]

export interface SupplyCategoryOption {
  value: string
  label: string
  icon: string
  defaultUnit: string
}

const SUPPLY_CATEGORIES: SupplyCategoryOption[] = [
  { value: 'Medical',  label: 'Medical Supplies',     icon: '💊', defaultUnit: 'kits' },
  { value: 'Food',     label: 'Food & Rations',       icon: '🍲', defaultUnit: 'packs' },
  { value: 'Water',    label: 'Water',                icon: '💧', defaultUnit: 'bottles' },
  { value: 'Blankets', label: 'Blankets',             icon: '🛏️', defaultUnit: 'pieces' },
  { value: 'Hygiene',  label: 'Hygiene Kits',         icon: '🧼', defaultUnit: 'kits' },
  { value: 'Shelter',  label: 'Shelter & Tarpaulins', icon: '⛺', defaultUnit: 'units' },
]

const QUICK_NEEDS = ['Water', 'Food', 'Blankets', 'Medical', 'Hygiene', 'Shelter']

export function CreateDrivePage() {
  const navigate = useNavigate()
  const createDrive = useCreateDrive()
  const { user } = useAuth()

  // 1. Basic & Destination
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fromCity, setFromCity] = useState('')
  const [toCity, setToCity] = useState('')
  const [destinationEvent, setDestinationEvent] = useState('')
  const [destinationCamp, setDestinationCamp] = useState('')

  // 2. Organizer details
  const [organizerName, setOrganizerName] = useState(user?.name || '')
  const [organizerContact, setOrganizerContact] = useState(user?.phone || '')
  const [allowCalls, setAllowCalls] = useState(true)

  // Prefill organizer details from user profile when user state is loaded
  useEffect(() => {
    if (user) {
      if (!organizerName && user.name) setOrganizerName(user.name)
      if (!organizerContact && user.phone) setOrganizerContact(user.phone)
    }
  }, [user?.name, user?.phone])

  // 3. Collection point (Map Picker)
  const [collectionLocation, setCollectionLocation] = useState('')
  const [collectionAddress, setCollectionAddress] = useState('')
  const [collectionLat, setCollectionLat] = useState<number | null>(null)
  const [collectionLng, setCollectionLng] = useState<number | null>(null)
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)

  // 4. Schedule & Logistics
  const [departureDate, setDepartureDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [vehicleType, setVehicleType] = useState('Truck')
  const [capacityKg, setCapacityKg] = useState<number | ''>(500)

  // 5. Pickup & Logistics Options
  const [pickupEnabled, setPickupEnabled] = useState(true)
  const [pickupRadiusKm, setPickupRadiusKm] = useState<number>(15)
  const [allowDropoff, setAllowDropoff] = useState(true)
  const [allowCourier, setAllowCourier] = useState(false)

  // 6. Target Items & Quantities
  const [targetItems, setTargetItems] = useState<TargetSupplyItem[]>([
    { name: 'Water (Bottles)', unit: 'bottles', target_quantity: 100 },
    { name: 'Warm Blankets', unit: 'pieces', target_quantity: 50 },
  ])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [customItemName, setCustomItemName] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('pieces')
  const [newItemQty, setNewItemQty] = useState<number | ''>('')

  // 7. Accepted & Unaccepted list
  const [acceptedItemsText, setAcceptedItemsText] = useState('Packed drinking water, New blankets, Dry biscuits, Sanitary pads')
  const [unacceptedItemsText, setUnacceptedItemsText] = useState('Cooked perishable food, Used/torn clothes, Expired medications')
  const [instructions, setInstructions] = useState('Please pack items securely in boxes and label them clearly with your name and item type.')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // AI-assisted planning state
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [aiInputText, setAiInputText] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiMissingInfo, setAiMissingInfo] = useState<string[]>([])
  const [aiAppliedAlert, setAiAppliedAlert] = useState(false)
  const [isAiProposedList, setIsAiProposedList] = useState(false)
  const [verifiedMatchingRequests, setVerifiedMatchingRequests] = useState<any[]>([])

  const handleAIAssist = async () => {
    if (!aiInputText.trim() || isAiLoading) return
    setIsAiLoading(true)
    setAiAppliedAlert(false)
    setAiMissingInfo([])
    setVerifiedMatchingRequests([])

    try {
      const parsed = await parseCollectionDrive(aiInputText.trim())

      if (parsed.title) setTitle(parsed.title)
      if (parsed.description) setDescription(parsed.description)
      if (parsed.from_city) setFromCity(parsed.from_city)
      if (parsed.to_city) setToCity(parsed.to_city)
      if (parsed.destination_event) setDestinationEvent(parsed.destination_event)

      // Query real verified open requests for the destination city
      let foundVerifiedRequests: any[] = []
      if (isSupabaseConfigured && parsed.to_city) {
        try {
          const { data, error } = await supabase
            .from('requests')
            .select('id, title, city, urgency, address_line, request_items(id, item_name, quantity_needed, unit)')
            .ilike('city', `%${parsed.to_city}%`)
            .eq('status', 'open')
            .limit(3)
          if (!error && data && data.length > 0) {
            foundVerifiedRequests = data
            setVerifiedMatchingRequests(data)
          }
        } catch (e) {
          console.warn('Could not query verified destination requests:', e)
        }
      }

      // If matching open requests exist, user can see verified requests.
      // If none exist, propose draft checklist from general needs clearly labeled as AI suggestions.
      if (parsed.target_items && parsed.target_items.length > 0) {
        setTargetItems(
          parsed.target_items.map(item => ({
            name: item.name,
            unit: item.unit || 'pieces',
            target_quantity: item.target_quantity || 50,
          }))
        )
        setIsAiProposedList(true)
      }

      if (parsed.missing_info && parsed.missing_info.length > 0) {
        setAiMissingInfo(parsed.missing_info)
      }

      setAiAppliedAlert(true)
      setToastMessage('Collection drive prefilled with AI suggestions. Review and modify fields below!')
      setTimeout(() => setToastMessage(null), 5000)
    } catch (err: any) {
      console.warn('AI collection drive assist failed:', err)
      setToastMessage('Could not analyze drive with AI. Please enter details manually.')
      setTimeout(() => setToastMessage(null), 4000)
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleMapConfirm = (address: string, lat: number, lng: number) => {
    setCollectionLocation(address)
    setCollectionAddress(address)
    setCollectionLat(lat)
    setCollectionLng(lng)
    if (errors.collectionLocation) {
      setErrors(prev => ({ ...prev, collectionLocation: '' }))
    }
  }

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val)
    if (val === 'Other') {
      setNewItemName(customItemName || '')
      return
    }
    const cat = SUPPLY_CATEGORIES.find(c => c.value === val)
    if (cat) {
      setNewItemName(cat.value)
      setNewItemUnit(cat.defaultUnit)
    } else {
      setNewItemName(val)
    }
  }

  const addTargetItem = () => {
    const effectiveName = selectedCategory === 'Other'
      ? customItemName.trim()
      : (selectedCategory.trim() || newItemName.trim())
    if (!effectiveName) return
    const qty = Number(newItemQty)
    if (!qty || qty <= 0) return

    setTargetItems(prev => [
      ...prev,
      {
        name: effectiveName,
        unit: newItemUnit.trim() || 'pieces',
        target_quantity: qty,
      },
    ])
    setSelectedCategory('')
    setCustomItemName('')
    setNewItemName('')
    setNewItemQty('')
    setNewItemUnit('pieces')
  }

  const removeTargetItem = (index: number) => {
    setTargetItems(prev => prev.filter((_, idx) => idx !== index))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!fromCity.trim()) errs.fromCity = 'Collection starting city is required'
    if (!toCity.trim()) errs.toCity = 'Destination city is required'
    if (!destinationEvent.trim()) errs.destinationEvent = 'Disaster or relief event is required'
    if (!organizerName.trim()) errs.organizerName = 'Organizer name is required'
    if (!organizerContact.trim()) errs.organizerContact = 'Contact phone or info is required'
    if (!collectionLat || !collectionLng) {
      errs.collectionLocation = 'Please pin the exact collection location on the map'
    }
    if (!departureDate) errs.departureDate = 'Departure date is required'
    if (!capacityKg || Number(capacityKg) <= 0) errs.capacityKg = 'Capacity must be greater than 0 kg'
    if (targetItems.length === 0) {
      errs.targetItems = 'Please add at least one required item with a target quantity'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const acceptedItems = acceptedItemsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const unacceptedItems = unacceptedItemsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const needs = Array.from(new Set(targetItems.map(i => i.name)))

    try {
      const drive = await createDrive.mutateAsync({
        title: title.trim() || `${fromCity.trim()} to ${toCity.trim()} Relief Drive`,
        description: description.trim(),
        fromCity: fromCity.trim(),
        toCity: toCity.trim(),
        destinationEvent: destinationEvent.trim(),
        destinationCamp: destinationCamp.trim(),
        organizerName: organizerName.trim(),
        organizerContact: organizerContact.trim(),
        collectionLocation: collectionLocation.trim(),
        collectionAddress: collectionAddress.trim(),
        collectionLat,
        collectionLng,
        departureDate,
        deadline: deadline || undefined,
        vehicleType,
        capacityKg: Number(capacityKg) || 0,
        needs,
        targetItems,
        acceptedItems,
        unacceptedItems,
        instructions: instructions.trim(),
        pickupEnabled,
        pickupRadiusKm,
        allowPickup: pickupEnabled,
        allowDropoff,
        allowCourier,
        requireDropoff: !pickupEnabled && allowDropoff,
        allowCalls,
      })

      navigate(`/drives/${drive.id}`)
    } catch (err: any) {
      console.error('Failed to create collection drive:', err)
      setToastMessage(err.message || 'Failed to create collection drive. Please check your inputs.')
      setTimeout(() => setToastMessage(null), 5000)
    }
  }

  return (
    <AppShell>
      <TopBar title="Start Collection Drive" showBack variant="navy" />
      <div className="pt-20 px-4 pb-20 max-w-xl mx-auto flex flex-col gap-6">
        {/* Header Banner */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-h2 font-bold text-navy-900 leading-tight">
              Organize a Collection Drive
            </h1>
            <p className="text-caption text-ink-muted mt-1 leading-relaxed">
              Mobilize local donations in your city and transport essential supplies directly to disaster relief camps.
            </p>
          </div>
        </div>

        {createDrive.isError && (
          <div className="bg-danger-bg border border-red-200 rounded-card p-3 flex items-start gap-2.5 text-caption text-danger font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{(createDrive.error as any)?.message || 'An error occurred while creating the drive.'}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* ── AI Assistant Feature ── */}
          <div className="rounded-card border border-brand-200 bg-brand-50/50 p-4 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-body font-semibold text-navy-900 leading-snug">
                    Assist with AI
                  </h3>
                  <p className="text-[12px] text-ink-muted">
                    Describe your drive (e.g. collecting in Erode for Chennai floods) to prefill route, event, and supplies.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiPromptOpen(prev => !prev)}
                className="text-caption font-semibold text-brand-600 hover:text-brand-700 px-2.5 py-1 rounded-pill bg-white border border-brand-200 shadow-xs"
              >
                {aiPromptOpen ? 'Close' : 'Try AI'}
              </button>
            </div>

            {aiPromptOpen && (
              <div className="mt-3.5 pt-3.5 border-t border-brand-100/80 flex flex-col gap-2.5">
                <textarea
                  placeholder="e.g. 'I\'m collecting supplies from families in Erode to deliver to people affected by floods in Chennai.'"
                  rows={2}
                  value={aiInputText}
                  onChange={e => setAiInputText(e.target.value)}
                  className="w-full rounded-input bg-white border border-slate-300 p-3 text-body text-ink transition-all focus:outline-none focus:border-brand-600 resize-none text-[14px]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted">
                    AI suggestions are strictly drafts and require human confirmation.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleAIAssist}
                    disabled={isAiLoading || !aiInputText.trim()}
                    className="gap-1.5 shrink-0"
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Prefill Drive</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* AI Applied confirmation banner */}
            {aiAppliedAlert && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-caption flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900">Drive details prefilled!</p>
                  <p className="text-[12px] text-emerald-700 mt-0.5">
                    Cities, title, event, and target supply checklist have been drafted. You can modify any item or quantity.
                  </p>
                </div>
              </div>
            )}

            {/* Verified Matching Requests Suggestions */}
            {verifiedMatchingRequests.length > 0 && (
              <div className="mt-3 p-3.5 rounded-lg bg-blue-50/90 border border-blue-200 text-navy-900 text-caption flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  <span className="font-semibold text-navy-900">
                    Verified open ReliefLink requests in {toCity || 'Destination'}:
                  </span>
                </div>
                <div className="space-y-2 mt-0.5">
                  {verifiedMatchingRequests.map((req) => (
                    <div key={req.id} className="bg-white p-2.5 rounded-md border border-blue-100 text-ink shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[13px] text-navy-900">{req.title}</span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-brand-700">
                          {req.urgency}
                        </span>
                      </div>
                      <p className="text-[12px] text-ink-muted mt-0.5">
                        {req.address_line || req.city}
                      </p>
                      {req.request_items && req.request_items.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {req.request_items.map((it: any) => (
                            <span key={it.id} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-ink-muted font-medium">
                              {it.item_name} ({it.quantity_needed} {it.unit})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If no verified requests found but AI proposed general needs */}
            {isAiProposedList && verifiedMatchingRequests.length === 0 && (
              <div className="mt-3 p-3 rounded-lg bg-slate-100 border border-slate-200 text-ink text-caption flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">AI Suggested Checklist (Unverified general needs)</p>
                  <p className="text-[12px] text-slate-600 mt-0.5">
                    No verified requests were found for this destination yet. Proposed items are general disaster recommendations. Please adjust quantities to match your vehicle's capacity.
                  </p>
                </div>
              </div>
            )}

            {/* Missing Information checklist */}
            {aiMissingInfo.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-caption flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Missing logistics information:</p>
                  <ul className="list-disc list-inside mt-1 text-[12px] text-amber-800 space-y-0.5">
                    {aiMissingInfo.map((info, idx) => (
                      <li key={idx}>{info}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* 1. Drive Overview & Purpose */}
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Package className="w-4 h-4 text-brand-600" />
              <h2 className="text-body font-semibold text-navy-900">Drive Overview & Purpose</h2>
            </div>

            <Input
              id="drive-title"
              label="Drive Title (Optional)"
              placeholder="e.g. Erode to Royapettah Relief Vehicle"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="drive-desc" className="text-caption font-semibold text-ink">
                Description & Goal
              </label>
              <textarea
                id="drive-desc"
                rows={3}
                placeholder="Explain the mission, which relief camps you are helping, and why these supplies matter…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-input bg-surface-low border border-slate-300 p-3 text-body text-ink transition-all focus:outline-none focus:bg-surface focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                id="from-city"
                label="Collection City *"
                placeholder="e.g. Erode, Coimbatore"
                value={fromCity}
                onChange={e => {
                  setFromCity(e.target.value)
                  if (errors.fromCity) setErrors(prev => ({ ...prev, fromCity: '' }))
                }}
                error={errors.fromCity}
              />
              <Input
                id="to-city"
                label="Destination City *"
                placeholder="e.g. Chennai, Wayanad"
                value={toCity}
                onChange={e => {
                  setToCity(e.target.value)
                  if (errors.toCity) setErrors(prev => ({ ...prev, toCity: '' }))
                }}
                error={errors.toCity}
              />
            </div>

            <Input
              id="destination-event"
              label="Disaster Relief Campaign *"
              placeholder="e.g. Chennai Flood Relief 2026"
              value={destinationEvent}
              onChange={e => {
                setDestinationEvent(e.target.value)
                if (errors.destinationEvent) setErrors(prev => ({ ...prev, destinationEvent: '' }))
              }}
              error={errors.destinationEvent}
            />

            <Input
              id="destination-camp"
              label="Destination Relief Camp / Center"
              placeholder="e.g. Royapettah Relief Base / Camp 4"
              value={destinationCamp}
              onChange={e => setDestinationCamp(e.target.value)}
            />
          </Card>

          {/* 2. Collection Hub & Exact Pin Location */}
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-600" />
                <h2 className="text-body font-semibold text-navy-900">Collection Point Location *</h2>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">
                Exact Coordinates
              </span>
            </div>

            <p className="text-caption text-ink-muted">
              Choose your collection warehouse, community hall, or pickup depot. Accurate coordinates ensure distance verification for pickups and directions.
            </p>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsMapPickerOpen(true)}
                className="w-full flex items-center justify-center gap-2 border-brand-600/30 text-brand-600 hover:bg-brand-50"
              >
                <MapPin className="w-4 h-4" />
                <span>{collectionLat ? 'Change pinned location' : 'Pin collection point on map *'}</span>
              </Button>

              {collectionLat && collectionLng && (
                <div className="bg-brand-50/70 border border-brand-200 rounded-card p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-navy-900 font-semibold text-caption">
                    <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                    <span className="truncate">{collectionLocation || 'Pinned Location'}</span>
                  </div>
                  <div className="text-[12px] font-mono text-ink-muted pl-6">
                    Lat: {collectionLat.toFixed(5)}, Lng: {collectionLng.toFixed(5)}
                  </div>
                </div>
              )}

              {errors.collectionLocation && (
                <p className="text-caption text-danger font-medium">{errors.collectionLocation}</p>
              )}
            </div>

            <Input
              id="collection-location-name"
              label="Collection Hub Label / Landmark"
              placeholder="e.g. Central Community Hall, Bus Stand Road"
              value={collectionLocation}
              onChange={e => setCollectionLocation(e.target.value)}
            />
          </Card>

          {/* 3. Organizer Contact */}
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <h2 className="text-body font-semibold text-navy-900">Organizer Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                id="organizer-name"
                label="Organizer Name / Group *"
                placeholder="e.g. Erode Youth Forum"
                value={organizerName}
                onChange={e => {
                  setOrganizerName(e.target.value)
                  if (errors.organizerName) setErrors(prev => ({ ...prev, organizerName: '' }))
                }}
                error={errors.organizerName}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="organizer-contact" className="text-caption font-semibold text-ink">
                    Contact Phone / WhatsApp *
                  </label>
                  {user?.phone && organizerContact === user.phone && (
                    <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-pill">
                      Prefilled from profile
                    </span>
                  )}
                </div>
                <Input
                  id="organizer-contact"
                  placeholder="e.g. +91 98401 23456"
                  value={organizerContact}
                  onChange={e => {
                    setOrganizerContact(e.target.value)
                    if (errors.organizerContact) setErrors(prev => ({ ...prev, organizerContact: '' }))
                  }}
                  error={errors.organizerContact}
                />
              </div>
            </div>

            {/* Owner-controlled call button setting */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80 mt-1">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5">
                  {allowCalls ? (
                    <Phone className="w-3.5 h-3.5 text-brand-600" />
                  ) : (
                    <PhoneOff className="w-3.5 h-3.5 text-ink-muted" />
                  )}
                  <span className="text-body font-semibold text-navy-900">
                    Enable Direct Call Button
                  </span>
                </div>
                <p className="text-[12px] text-ink-muted leading-relaxed">
                  {allowCalls
                    ? 'Donors can tap "Call Organizer" via their phone dialer. Your raw phone digits are hidden from public view.'
                    : 'Call button is hidden. Donors will coordinate through the collection drop-off points.'}
                </p>
              </div>
              <input
                type="checkbox"
                id="drive-allow-calls-toggle"
                checked={allowCalls}
                onChange={e => setAllowCalls(e.target.checked)}
                className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-600 cursor-pointer shrink-0"
              />
            </div>
          </Card>

          {/* 4. Target Supplies & Quantities */}
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                <h2 className="text-body font-semibold text-navy-900">Required Items & Targets *</h2>
              </div>
              <span className="text-caption text-ink-muted">Define quantities</span>
            </div>

            {targetItems.length > 0 && (
              <div className="flex flex-col gap-2">
                {targetItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-card"
                  >
                    <div>
                      <span className="text-body font-semibold text-navy-900">{item.name}</span>
                      <span className="text-caption text-ink-muted ml-2">
                        Target: {item.target_quantity} {item.unit}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTargetItem(idx)}
                      className="text-ink-muted hover:text-danger p-1 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errors.targetItems && (
              <p className="text-caption text-danger font-medium">{errors.targetItems}</p>
            )}

            {/* Add Target Item Row */}
            <div className="bg-surface-low border border-slate-200 rounded-card p-3 flex flex-col gap-2.5">
              <span className="text-[12px] font-semibold text-ink uppercase tracking-wider">
                Add Supply Requirement
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* 1. Item Selector */}
                <div className="sm:col-span-6 flex flex-col gap-1.5">
                  <label htmlFor="item-selector" className="text-caption font-semibold text-ink">
                    Item / Category *
                  </label>
                  <div className="relative flex items-center">
                    <select
                      id="item-selector"
                      aria-label="Select an item"
                      value={selectedCategory}
                      onChange={e => handleCategoryChange(e.target.value)}
                      className={cn(
                        'w-full h-11 rounded-input bg-surface border border-slate-300 px-3.5 pr-10',
                        'text-body appearance-none cursor-pointer',
                        'transition-all focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20',
                        !selectedCategory ? 'text-ink-muted' : 'text-navy-900 font-semibold',
                      )}
                    >
                      <option value="" disabled className="text-ink-muted">
                        Select an item
                      </option>
                      {SUPPLY_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value} className="text-navy-900 font-medium py-1">
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                      <option value="Other" className="text-navy-900 font-medium py-1">
                        ✏️ Other / Custom Item…
                      </option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 pointer-events-none" />
                  </div>
                </div>

                {/* 2. Target Quantity Input */}
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <label htmlFor="item-target-qty" className="text-caption font-semibold text-ink">
                    Target Qty *
                  </label>
                  <input
                    id="item-target-qty"
                    type="number"
                    min="1"
                    placeholder="e.g. 100"
                    value={newItemQty}
                    onChange={e => setNewItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full h-11 rounded-input bg-surface border border-slate-300 px-3.5 text-body text-navy-900 font-medium placeholder:text-ink-muted transition-all focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </div>

                {/* 3. Unit Input */}
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <label htmlFor="item-unit-input" className="text-caption font-semibold text-ink">
                    Unit *
                  </label>
                  <input
                    id="item-unit-input"
                    type="text"
                    placeholder="e.g. bottles"
                    value={newItemUnit}
                    onChange={e => setNewItemUnit(e.target.value)}
                    className="w-full h-11 rounded-input bg-surface border border-slate-300 px-3.5 text-body text-navy-900 font-medium placeholder:text-ink-muted transition-all focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </div>
              </div>

              {/* If "Other" category is chosen, allow typing a custom name */}
              {selectedCategory === 'Other' && (
                <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
                  <label htmlFor="custom-item-name" className="text-caption font-semibold text-ink">
                    Custom Item Name *
                  </label>
                  <input
                    id="custom-item-name"
                    type="text"
                    placeholder="Specify item name (e.g. Baby formula, Tarpaulin rolls)"
                    value={customItemName}
                    onChange={e => {
                      setCustomItemName(e.target.value)
                      setNewItemName(e.target.value)
                    }}
                    className="w-full h-11 rounded-input bg-surface border border-slate-300 px-3.5 text-body text-navy-900 font-medium placeholder:text-ink-muted transition-all focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </div>
              )}

              {/* Quick Category Pick Chips & Add Item Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] text-ink-muted font-medium mr-1">Quick select:</span>
                  {SUPPLY_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => handleCategoryChange(cat.value)}
                      className={cn(
                        'text-[12px] px-2.5 py-1 rounded-pill transition-all font-medium flex items-center gap-1 cursor-pointer active:scale-95',
                        selectedCategory === cat.value
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-ink border border-slate-200/80'
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.value}</span>
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  id="add-item-btn"
                  variant="primary"
                  size="sm"
                  onClick={addTargetItem}
                  disabled={
                    !(selectedCategory === 'Other' ? customItemName.trim() : (selectedCategory || newItemName.trim())) ||
                    !newItemQty ||
                    Number(newItemQty) <= 0
                  }
                  className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-medium shrink-0 h-10 px-4 gap-1.5"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>
          </Card>

          {/* 5. Pickup & Delivery Options */}
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand-600" />
                <h2 className="text-body font-semibold text-navy-900">Pickup & Drop-off Logistics</h2>
              </div>
            </div>

            {/* Pickup toggle */}
            <div className="flex items-center justify-between p-3 rounded-card bg-slate-50 border border-slate-200">
              <div className="space-y-0.5 pr-2">
                <span className="text-body font-semibold text-navy-900 block">Offer Volunteer Pickup</span>
                <span className="text-caption text-ink-muted block">
                  Volunteers can collect donations from donors within a set radius
                </span>
              </div>
              <input
                type="checkbox"
                checked={pickupEnabled}
                onChange={e => setPickupEnabled(e.target.checked)}
                className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-600"
              />
            </div>

            {pickupEnabled && (
              <div className="pl-3 border-l-2 border-brand-600 flex flex-col gap-2">
                <label className="text-caption font-semibold text-ink">
                  Pickup Radius Distance *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 20].map(radius => (
                    <button
                      key={radius}
                      type="button"
                      onClick={() => setPickupRadiusKm(radius)}
                      className={cn(
                        'py-2 px-3 rounded-card text-caption font-semibold border transition-all text-center',
                        pickupRadiusKm === radius
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-surface border-slate-200 text-ink hover:bg-slate-50'
                      )}
                    >
                      {radius} km radius
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-ink-muted">
                  Donors further than {pickupRadiusKm} km will be instructed to deliver directly to the collection point.
                </p>
              </div>
            )}

            {/* Dropoff toggle */}
            <div className="flex items-center justify-between p-3 rounded-card bg-slate-50 border border-slate-200">
              <div className="space-y-0.5 pr-2">
                <span className="text-body font-semibold text-navy-900 block">Allow Self-Delivery / Drop-off</span>
                <span className="text-caption text-ink-muted block">
                  Donors can drop off supplies directly at the pinned collection point
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowDropoff}
                onChange={e => setAllowDropoff(e.target.checked)}
                className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-600"
              />
            </div>

            {/* Courier toggle */}
            <div className="flex items-center justify-between p-3 rounded-card bg-slate-50 border border-slate-200">
              <div className="space-y-0.5 pr-2">
                <span className="text-body font-semibold text-navy-900 block">Allow Courier / Transport Delivery</span>
                <span className="text-caption text-ink-muted block">
                  Donors can courier parcels directly to your collection point address
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowCourier}
                onChange={e => setAllowCourier(e.target.checked)}
                className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-600"
              />
            </div>
          </Card>

          {/* 6. Vehicle, Capacity & Dates */}
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-4 h-4 text-brand-600" />
              <h2 className="text-body font-semibold text-navy-900">Vehicle & Schedule</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5 w-full">
                <label htmlFor="departure-date" className="text-caption font-semibold text-ink">
                  Departure Date *
                </label>
                <input
                  id="departure-date"
                  type="date"
                  value={departureDate}
                  onChange={e => {
                    setDepartureDate(e.target.value)
                    if (errors.departureDate) setErrors(prev => ({ ...prev, departureDate: '' }))
                  }}
                  className={cn(
                    'w-full h-12 rounded-input bg-surface-low border border-slate-300 px-3.5 text-body text-ink transition-all focus:bg-surface focus:border-brand-600',
                    errors.departureDate && 'border-danger'
                  )}
                />
                {errors.departureDate && (
                  <p className="text-caption text-danger">{errors.departureDate}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5 w-full">
                <label htmlFor="drive-deadline" className="text-caption font-semibold text-ink">
                  Collection Deadline
                </label>
                <input
                  id="drive-deadline"
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full h-12 rounded-input bg-surface-low border border-slate-300 px-3.5 text-body text-ink transition-all focus:bg-surface focus:border-brand-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Select
                id="vehicle-type"
                label="Transport Vehicle *"
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value)}
                options={VEHICLE_OPTIONS}
              />

              <Input
                id="capacity-kg"
                label="Vehicle Capacity (kg) *"
                type="number"
                min="1"
                step="1"
                value={capacityKg}
                onChange={e => {
                  const val = e.target.value === '' ? '' : Number(e.target.value)
                  setCapacityKg(val)
                  if (errors.capacityKg) setErrors(prev => ({ ...prev, capacityKg: '' }))
                }}
                error={errors.capacityKg}
              />
            </div>
          </Card>

          {/* 7. Accepted & Unaccepted Guidelines */}
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Info className="w-4 h-4 text-brand-600" />
              <h2 className="text-body font-semibold text-navy-900">Donation Guidelines</h2>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="accepted-items" className="text-caption font-semibold text-ink">
                Accepted Items (comma-separated)
              </label>
              <textarea
                id="accepted-items"
                rows={2}
                value={acceptedItemsText}
                onChange={e => setAcceptedItemsText(e.target.value)}
                className="w-full rounded-input bg-surface-low border border-slate-300 p-3 text-body text-ink focus:bg-surface focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="unaccepted-items" className="text-caption font-semibold text-danger">
                Explicitly Unaccepted Items (comma-separated)
              </label>
              <textarea
                id="unaccepted-items"
                rows={2}
                value={unacceptedItemsText}
                onChange={e => setUnacceptedItemsText(e.target.value)}
                className="w-full rounded-input bg-surface-low border border-red-200 p-3 text-body text-ink focus:bg-surface focus:border-danger focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="instructions" className="text-caption font-semibold text-ink">
                Special Packaging Instructions
              </label>
              <textarea
                id="instructions"
                rows={2}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                className="w-full rounded-input bg-surface-low border border-slate-300 p-3 text-body text-ink focus:bg-surface focus:border-brand-600 focus:outline-none"
              />
            </div>
          </Card>

          {/* Submit Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createDrive.isPending}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 shadow-md"
            >
              Publish Collection Drive
            </Button>
          </div>
        </form>
      </div>

      {/* Map Picker Modal */}
      <LocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onConfirm={handleMapConfirm}
        initialLat={collectionLat || undefined}
        initialLng={collectionLng || undefined}
      />

      <Toast message={toastMessage} visible={Boolean(toastMessage)} variant="danger" />
    </AppShell>
  )
}
