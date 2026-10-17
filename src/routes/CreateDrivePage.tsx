import { useState } from 'react'
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
} from 'lucide-react'
import { useCreateDrive } from '@/hooks/useDrives'
import type { TargetSupplyItem } from '@/types'
import { cn } from '@/utils/cn'

const VEHICLE_OPTIONS = [
  { value: 'Truck', label: 'Truck (Heavy Logistics)' },
  { value: 'Van', label: 'Tempo / Van (Medium)' },
  { value: 'Car', label: 'Car / SUV (Small)' },
  { value: 'Two-wheeler', label: 'Two-wheeler / Bike' },
]

const QUICK_NEEDS = ['Water', 'Food', 'Blankets', 'Medical', 'Hygiene', 'Shelter']

export function CreateDrivePage() {
  const navigate = useNavigate()
  const createDrive = useCreateDrive()

  // 1. Basic & Destination
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fromCity, setFromCity] = useState('')
  const [toCity, setToCity] = useState('')
  const [destinationEvent, setDestinationEvent] = useState('')
  const [destinationCamp, setDestinationCamp] = useState('')

  // 2. Organizer details
  const [organizerName, setOrganizerName] = useState('')
  const [organizerContact, setOrganizerContact] = useState('')

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
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('pieces')
  const [newItemQty, setNewItemQty] = useState<number | ''>('')

  // 7. Accepted & Unaccepted list
  const [acceptedItemsText, setAcceptedItemsText] = useState('Packed drinking water, New blankets, Dry biscuits, Sanitary pads')
  const [unacceptedItemsText, setUnacceptedItemsText] = useState('Cooked perishable food, Used/torn clothes, Expired medications')
  const [instructions, setInstructions] = useState('Please pack items securely in boxes and label them clearly with your name and item type.')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleMapConfirm = (address: string, lat: number, lng: number) => {
    setCollectionLocation(address)
    setCollectionAddress(address)
    setCollectionLat(lat)
    setCollectionLng(lng)
    if (errors.collectionLocation) {
      setErrors(prev => ({ ...prev, collectionLocation: '' }))
    }
  }

  const addTargetItem = () => {
    if (!newItemName.trim()) return
    const qty = Number(newItemQty)
    if (!qty || qty <= 0) return

    setTargetItems(prev => [
      ...prev,
      {
        name: newItemName.trim(),
        unit: newItemUnit.trim() || 'units',
        target_quantity: qty,
      },
    ])
    setNewItemName('')
    setNewItemQty('')
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
              <Input
                id="organizer-contact"
                label="Contact Phone / WhatsApp *"
                placeholder="e.g. +91 98401 23456"
                value={organizerContact}
                onChange={e => {
                  setOrganizerContact(e.target.value)
                  if (errors.organizerContact) setErrors(prev => ({ ...prev, organizerContact: '' }))
                }}
                error={errors.organizerContact}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Item (e.g. Blankets)"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-slate-300 text-body bg-white text-ink focus:border-brand-600 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Target quantity"
                  min="1"
                  value={newItemQty}
                  onChange={e => setNewItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-10 px-3 rounded-lg border border-slate-300 text-body bg-white text-ink focus:border-brand-600 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Unit (e.g. pieces, kg)"
                  value={newItemUnit}
                  onChange={e => setNewItemUnit(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-slate-300 text-body bg-white text-ink focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-wrap gap-1">
                  {QUICK_NEEDS.map(need => (
                    <button
                      key={need}
                      type="button"
                      onClick={() => setNewItemName(need)}
                      className="text-[11px] px-2 py-0.5 bg-slate-200/80 hover:bg-brand-100 hover:text-brand-600 rounded-pill text-ink transition-colors"
                    >
                      +{need}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addTargetItem}
                  disabled={!newItemName.trim() || !newItemQty}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-medium"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
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
