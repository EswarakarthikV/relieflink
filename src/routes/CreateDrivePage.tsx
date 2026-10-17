import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toast } from '@/components/ui/Toast'
import { Truck, MapPin, Calendar, Check, AlertTriangle } from 'lucide-react'
import { useCreateDrive } from '@/hooks/useDrives'
import { cn } from '@/utils/cn'

const VEHICLE_OPTIONS = [
  { value: 'Truck', label: 'Truck' },
  { value: 'Car', label: 'Car' },
  { value: 'Van', label: 'Van' },
  { value: 'Two-wheeler', label: 'Two-wheeler' },
]

const NEEDS_OPTIONS = [
  'Water',
  'Food',
  'Hygiene',
  'Medical',
  'Shelter',
  'Other',
]

export function CreateDrivePage() {
  const navigate = useNavigate()
  const createDrive = useCreateDrive()

  const [fromCity, setFromCity] = useState('')
  const [toCity, setToCity] = useState('')
  const [destinationEvent, setDestinationEvent] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [vehicleType, setVehicleType] = useState('Truck')
  const [capacityKg, setCapacityKg] = useState<number | ''>(500)
  const [needs, setNeeds] = useState<string[]>(['Water', 'Food'])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const toggleNeed = (item: string) => {
    setNeeds(prev =>
      prev.includes(item) ? prev.filter(n => n !== item) : [...prev, item],
    )
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!fromCity.trim()) errs.fromCity = 'From City is required'
    if (!toCity.trim()) errs.toCity = 'To City is required'
    if (!destinationEvent.trim()) errs.destinationEvent = 'Destination Event is required'
    if (!departureDate) errs.departureDate = 'Departure Date is required'
    if (!capacityKg || Number(capacityKg) <= 0) errs.capacityKg = 'Capacity must be greater than 0 kg'
    if (needs.length === 0) errs.needs = 'Please select at least one item needed'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    try {
      const drive = await createDrive.mutateAsync({
        fromCity: fromCity.trim(),
        toCity: toCity.trim(),
        destinationEvent: destinationEvent.trim(),
        departureDate,
        vehicleType,
        capacityKg: Number(capacityKg) || 0,
        needs,
      })

      navigate(`/drives/${drive.id}`)
    } catch (err: any) {
      console.error('Failed to create collection drive:', err)
      setToastMessage(err.message || 'Failed to create collection drive. Please try again.')
      setTimeout(() => setToastMessage(null), 4000)
    }
  }

  return (
    <AppShell>
      <TopBar title="New Collection Drive" showBack variant="navy" />
      <div className="pt-20 px-4 pb-12 max-w-xl mx-auto flex flex-col gap-6">
        {/* Header Intro */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-card bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-h2 font-semibold text-navy-900 leading-tight">Start a Collection Drive</h1>
            <p className="text-caption text-ink-muted mt-0.5">
              Coordinate donations from your city and deliver directly to relief camps
            </p>
          </div>
        </div>

        {createDrive.isError && (
          <div className="bg-danger-bg border border-red-200 rounded-card p-3 flex items-start gap-2 text-caption text-danger font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
            <span>{(createDrive.error as any)?.message || 'An error occurred'}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4 text-brand-600" />
              <h2 className="text-body font-semibold text-navy-900">Route & Destination</h2>
            </div>

            {/* From City */}
            <Input
              id="from-city"
              label="From City *"
              placeholder="e.g. Erode, Bangalore, Pune"
              value={fromCity}
              onChange={e => {
                setFromCity(e.target.value)
                if (errors.fromCity) setErrors(prev => ({ ...prev, fromCity: '' }))
              }}
              error={errors.fromCity}
            />

            {/* To City */}
            <Input
              id="to-city"
              label="To City *"
              placeholder="e.g. Chennai, Wayanad"
              value={toCity}
              onChange={e => {
                setToCity(e.target.value)
                if (errors.toCity) setErrors(prev => ({ ...prev, toCity: '' }))
              }}
              error={errors.toCity}
            />

            {/* Destination Event */}
            <Input
              id="destination-event"
              label="Destination Event *"
              placeholder="e.g. Chennai Flood Relief"
              value={destinationEvent}
              onChange={e => {
                setDestinationEvent(e.target.value)
                if (errors.destinationEvent) setErrors(prev => ({ ...prev, destinationEvent: '' }))
              }}
              error={errors.destinationEvent}
            />
          </Card>

          <Card className="p-5 flex flex-col gap-4 border border-slate-200 shadow-card">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-4 h-4 text-brand-600" />
              <h2 className="text-body font-semibold text-navy-900">Logistics & Schedule</h2>
            </div>

            {/* Departure Date */}
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
                  'w-full h-12 rounded-input bg-surface-low border border-slate-300 px-3.5',
                  'text-body text-ink transition-all focus:outline-none focus:bg-surface focus:border-brand-600',
                  'focus:ring-2 focus:ring-brand-600/20',
                  errors.departureDate && 'border-danger',
                )}
              />
              {errors.departureDate && (
                <p className="text-caption text-danger">{errors.departureDate}</p>
              )}
            </div>

            {/* Vehicle Type */}
            <Select
              id="vehicle-type"
              label="Vehicle Type *"
              value={vehicleType}
              onChange={e => setVehicleType(e.target.value)}
              options={VEHICLE_OPTIONS}
            />

            {/* Capacity (kg) */}
            <Input
              id="capacity-kg"
              label="Capacity (kg) *"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 500"
              value={capacityKg}
              onChange={e => {
                const val = e.target.value === '' ? '' : Number(e.target.value)
                setCapacityKg(val)
                if (errors.capacityKg) setErrors(prev => ({ ...prev, capacityKg: '' }))
              }}
              error={errors.capacityKg}
            />
          </Card>

          <Card className="p-5 flex flex-col gap-3 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-body font-semibold text-navy-900">Supplies Needed *</h2>
              <span className="text-caption text-ink-muted">Select all that apply</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {NEEDS_OPTIONS.map(item => {
                const isSelected = needs.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      toggleNeed(item)
                      if (errors.needs) setErrors(prev => ({ ...prev, needs: '' }))
                    }}
                    className={cn(
                      'px-3.5 py-2 rounded-pill text-caption font-semibold transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95',
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-surface border-slate-300 text-ink hover:bg-slate-50 hover:border-slate-400',
                    )}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>{item}</span>
                  </button>
                )
              })}
            </div>
            {errors.needs && <p className="text-caption text-danger">{errors.needs}</p>}
          </Card>

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
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              Start collection drive
            </Button>
          </div>
        </form>
      </div>

      <Toast message={toastMessage} visible={Boolean(toastMessage)} variant="danger" />
    </AppShell>
  )
}
