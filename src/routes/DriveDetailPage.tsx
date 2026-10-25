import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { LocationPickerModal } from '@/components/LocationPickerModal'
import {
  Truck,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Package,
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Send,
  EyeOff,
  Navigation,
  FileCheck2,
  Phone,
  PhoneOff,
  Info,
  Check,
} from 'lucide-react'
import {
  useDrive,
  useDriveContributions,
  usePublicDriveContributions,
  useCreateDriveContribution,
  useUpdateDriveContributionStatus,
  useDispatchDrive,
  useMarkDriveDelivered,
  useConfirmDriveReceipt,
  calculateDistanceKm,
} from '@/hooks/useDrives'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  DriveContribution,
  DriveContributionStatus,
  DriveDeliveryMethod,
  ContributionItem,
} from '@/types'
import { cn } from '@/utils/cn'

export function DriveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: drive, isLoading, isError, refetch } = useDrive(id)
  const { data: contributions = [], refetch: refetchContribs } = useDriveContributions(id)
  const { data: publicContribs = [] } = usePublicDriveContributions(id)

  const createContribution = useCreateDriveContribution()
  const updateStatus = useUpdateDriveContributionStatus()
  const dispatchDriveMut = useDispatchDrive()
  const markDeliveredMut = useMarkDriveDelivered()
  const confirmReceiptMut = useConfirmDriveReceipt()

  // Auth / Role check
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVariant, setToastVariant] = useState<'success' | 'danger'>('success')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const isOrganizer = Boolean(
    drive && (currentUserId === drive.collector_id || drive.collector_id === 'usr-mock-collector')
  )

  // ── Contribute Modal State ──────────────────────────────────────────────────
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false)

  // Lock body scroll when Contribute Modal is open
  useEffect(() => {
    if (isContributeModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isContributeModalOpen])

  const [donorName, setDonorName] = useState('')
  const [donorContact, setDonorContact] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<DriveDeliveryMethod>('self_delivery')
  const [donorAddress, setDonorAddress] = useState('')
  const [donorLat, setDonorLat] = useState<number | null>(null)
  const [donorLng, setDonorLng] = useState<number | null>(null)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<{ [itemName: string]: number }>({})
  const [customItemName, setCustomItemName] = useState('')
  const [customItemQty, setCustomItemQty] = useState<number | ''>('')
  const [customItemUnit, setCustomItemUnit] = useState('units')
  const [donorNotes, setDonorNotes] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ── Dispatch / Delivery Modal State ─────────────────────────────────────────
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)
  const [dispatchNotes, setDispatchNotes] = useState('')

  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false)
  const [deliveryNotes, setDeliveryNotes] = useState('')

  const [isConfirmReceiptModalOpen, setIsConfirmReceiptModalOpen] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientContact, setRecipientContact] = useState('')
  const [recipientNotes, setRecipientNotes] = useState('')

  // ── Distance Calculation ───────────────────────────────────────────────────
  const calculatedDistance = useMemo(() => {
    if (
      drive?.collection_lat != null &&
      drive?.collection_lng != null &&
      donorLat != null &&
      donorLng != null
    ) {
      return calculateDistanceKm(
        donorLat,
        donorLng,
        drive.collection_lat,
        drive.collection_lng
      )
    }
    return null
  }, [drive, donorLat, donorLng])

  const isPickupEligible = useMemo(() => {
    if (!drive?.pickup_enabled && !drive?.allow_pickup) return false
    if (calculatedDistance === null) return true // haven't pinned yet
    const radius = drive.pickup_radius_km || 15
    return calculatedDistance <= radius
  }, [drive, calculatedDistance])

  // ── Computed Quantities ─────────────────────────────────────────────────────
  const itemQuantities = useMemo(() => {
    const map: {
      [itemName: string]: {
        target: number
        unit: string
        pledged: number
        accepted: number
        collected: number
      }
    } = {}

    // Initialize from drive target items
    if (drive?.target_items) {
      for (const item of drive.target_items) {
        const pledgedVal = Number((item as any).pledged_quantity) || 0
        const collectedVal = Number((item as any).collected_quantity) || 0
        map[item.name] = {
          target: Number(item.target_quantity) || 0,
          unit: item.unit || 'units',
          pledged: pledgedVal,
          accepted: pledgedVal,
          collected: collectedVal,
        }
      }
    }

    // Accumulate from contributions (use organizer contributions if available, else public contributions)
    const effectiveContribs = (contributions && contributions.length > 0)
      ? contributions
      : (publicContribs && publicContribs.length > 0)
      ? (publicContribs as any[])
      : []

    console.log('[DriveDetailPage] Computing itemQuantities for drive:', drive?.id, {
      target_items: drive?.target_items,
      contributionsCount: contributions.length,
      publicContribsCount: publicContribs.length,
    })

    const activeContribs = effectiveContribs.filter(
      (c: any) => c.status !== 'declined' && c.status !== 'cancelled'
    )

    // If activeContribs exist, reset before re-accumulating to avoid double counting
    if (activeContribs.length > 0) {
      for (const k of Object.keys(map)) {
        map[k].pledged = 0
        map[k].accepted = 0
        map[k].collected = 0
      }
    }

    for (const contrib of activeContribs) {
      const itemsList = contrib.items || (contrib as any).contribution_items || []
      for (const item of itemsList) {
        const itemName = item.item_name || item.name
        if (!itemName) continue

        if (!map[itemName]) {
          map[itemName] = {
            target: 0,
            unit: item.unit || 'units',
            pledged: 0,
            accepted: 0,
            collected: 0,
          }
        }

        const qty = Number(item.quantity) || 0
        map[itemName].pledged += qty

        if (
          contrib.status === 'accepted' ||
          contrib.status === 'collection_arranged' ||
          contrib.status === 'collected' ||
          contrib.status === 'dispatched' ||
          contrib.status === 'delivered' ||
          contrib.status === 'receipt_confirmed'
        ) {
          map[itemName].accepted += qty
        }

        if (
          contrib.status === 'collected' ||
          contrib.status === 'dispatched' ||
          contrib.status === 'delivered' ||
          contrib.status === 'receipt_confirmed'
        ) {
          map[itemName].collected += qty
        }
      }
    }

    return map
  }, [drive, contributions, publicContribs])

  const totalCollectedUnits = useMemo(() => {
    return Object.values(itemQuantities).reduce((acc, curr) => acc + curr.collected, 0)
  }, [itemQuantities])

  const capacityKg = drive?.capacity_kg || 500
  const progressRatio = capacityKg > 0 ? Math.min(1, totalCollectedUnits / capacityKg) : 0

  const showToast = (msg: string, variant: 'success' | 'danger' = 'success') => {
    setToastMessage(msg)
    setToastVariant(variant)
    setTimeout(() => setToastMessage(null), 4500)
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleMapConfirmDonor = (address: string, lat: number, lng: number) => {
    setDonorAddress(address)
    setDonorLat(lat)
    setDonorLng(lng)
    setFormErrors(prev => ({ ...prev, donorAddress: '' }))
  }

  const handleContributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!drive) return

    const errs: Record<string, string> = {}
    if (!donorName.trim()) errs.donorName = 'Your name is required'

    // Check delivery method
    if (deliveryMethod === 'pickup') {
      if (!drive.pickup_enabled && !drive.allow_pickup) {
        errs.deliveryMethod = 'Pickup is not offered for this drive.'
      } else if (!donorLat || !donorLng) {
        errs.donorAddress = 'Please pin your pickup address on the map'
      } else if (!isPickupEligible) {
        errs.donorAddress = `Your location (${calculatedDistance?.toFixed(1)} km) is outside the ${drive.pickup_radius_km} km radius. Please choose self-delivery.`
      }
    }

    // Build items list
    const itemsToSubmit: ContributionItem[] = []
    for (const [name, qty] of Object.entries(selectedItems)) {
      if (qty > 0) {
        const targetDef = drive.target_items?.find(t => t.name === name)
        itemsToSubmit.push({
          item_name: name,
          quantity: qty,
          unit: targetDef?.unit || 'units',
        })
      }
    }

    if (customItemName.trim() && customItemQty && Number(customItemQty) > 0) {
      itemsToSubmit.push({
        item_name: customItemName.trim(),
        quantity: Number(customItemQty),
        unit: customItemUnit.trim() || 'units',
      })
    }

    if (itemsToSubmit.length === 0) {
      errs.items = 'Please select or add at least one item to donate'
    }

    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    try {
      await createContribution.mutateAsync({
        driveId: drive.id,
        donorName: donorName.trim(),
        donorContact: donorContact.trim() || undefined,
        isAnonymous,
        deliveryMethod,
        donorAddress: donorAddress.trim() || undefined,
        donorLat,
        donorLng,
        distanceKm: calculatedDistance || undefined,
        items: itemsToSubmit,
        notes: donorNotes.trim() || undefined,
      })

      setIsContributeModalOpen(false)
      setSelectedItems({})
      setCustomItemName('')
      setCustomItemQty('')
      setDonorNotes('')
      showToast(
        deliveryMethod === 'pickup'
          ? 'Donation submitted! Organizer will review and confirm your pickup.'
          : 'Thank you! Your donation offer has been registered.',
        'success'
      )
    } catch (err: any) {
      showToast(err.message || 'Failed to submit donation. Please try again.', 'danger')
    }
  }

  // Organizer Actions
  const handleUpdateStatus = async (
    contribId: string,
    status: DriveContributionStatus,
    notes?: string
  ) => {
    if (!drive) return
    try {
      await updateStatus.mutateAsync({
        contributionId: contribId,
        status,
        pickupNotes: notes,
        driveId: drive.id,
      })
      showToast(`Contribution updated to "${status.replace('_', ' ')}".`)
    } catch (err: any) {
      showToast(err.message || 'Failed to update status.', 'danger')
    }
  }

  const handleDispatch = async () => {
    if (!drive) return
    try {
      await dispatchDriveMut.mutateAsync({
        driveId: drive.id,
        dispatchNotes,
      })
      setIsDispatchModalOpen(false)
      showToast('Shipment dispatched! Status updated to in transit.')
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch drive.', 'danger')
    }
  }

  const handleMarkDelivered = async () => {
    if (!drive) return
    try {
      await markDeliveredMut.mutateAsync({
        driveId: drive.id,
        notes: deliveryNotes,
      })
      setIsDeliverModalOpen(false)
      showToast('Marked delivered! Awaiting receipt confirmation from recipient representative.')
    } catch (err: any) {
      showToast(err.message || 'Failed to record delivery.', 'danger')
    }
  }

  const handleConfirmReceipt = async () => {
    if (!drive) return
    if (!recipientName.trim()) {
      showToast('Recipient representative name is required.', 'danger')
      return
    }
    try {
      await confirmReceiptMut.mutateAsync({
        driveId: drive.id,
        recipientName,
        recipientContact,
        notes: recipientNotes,
      })
      setIsConfirmReceiptModalOpen(false)
      showToast('Delivery officially confirmed by recipient! Drive verified.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm receipt.', 'danger')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <TopBar title="Collection Drive" showBack variant="navy" />
        <div className="pt-20">
          <PageSpinner label="Loading collection drive details…" />
        </div>
      </AppShell>
    )
  }

  if (isError || !drive) {
    return (
      <AppShell>
        <TopBar title="Not Found" showBack variant="navy" />
        <div className="pt-20 px-4 flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mb-3" />
          <h2 className="text-h3 font-semibold text-ink">Drive not found</h2>
          <p className="text-caption text-ink-muted mt-1 mb-4">
            This collection drive could not be loaded or has been removed.
          </p>
          <Button variant="secondary" onClick={() => navigate('/browse?type=drives')}>
            Browse all drives
          </Button>
        </div>
      </AppShell>
    )
  }

  // Directions URLs (using exact coordinates at runtime)
  const collectionDirectionsUrl =
    drive.collection_lat != null && drive.collection_lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${drive.collection_lat},${drive.collection_lng}`
      : null

  const destinationDirectionsUrl =
    drive.destination_lat != null && drive.destination_lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${drive.destination_lat},${drive.destination_lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          drive.to_city || drive.destination_event
        )}`

  return (
    <AppShell>
      <TopBar title="Drive Details" showBack variant="navy" />
      <div className="pt-20 px-4 pb-28 max-w-xl mx-auto flex flex-col gap-5">
        {/* Route & Destination Banner */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-600 bg-brand-100 px-2.5 py-0.5 rounded-pill">
              Collection Drive
            </span>
            {drive.status === 'receipt_confirmed' ? (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-emerald-100 text-emerald-800 border border-emerald-300">
                Receipt Confirmed ✓
              </span>
            ) : drive.status === 'delivered' ? (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-blue-100 text-blue-800 border border-blue-200">
                Delivered (Awaiting Confirmation)
              </span>
            ) : drive.status === 'dispatched' ? (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-amber-100 text-amber-800 border border-amber-200">
                In Transit / Dispatched
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-success-bg text-success uppercase tracking-wider">
                {drive.status}
              </span>
            )}
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-navy-900 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-h2 font-bold text-navy-900 leading-snug flex items-center gap-2">
                <span>{drive.from_city}</span>
                <ArrowRight className="w-4 h-4 text-ink-muted shrink-0" />
                <span>{drive.to_city}</span>
              </h1>
              <p className="text-caption font-medium text-ink-muted mt-0.5">
                Relief Campaign: <span className="text-ink font-semibold">{drive.destination_event}</span>
                {drive.destination_camp && ` · ${drive.destination_camp}`}
              </p>
              {drive.title && (
                <p className="text-[13px] text-ink font-medium mt-1">"{drive.title}"</p>
              )}
            </div>
          </div>

          {/* Collection Point & Directions */}
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            <div className="flex items-start gap-2 text-caption">
              <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-navy-900 block">Collection Hub:</span>
                <span className="text-ink">{drive.collection_location || drive.collection_address || drive.from_city}</span>
                {drive.collection_lat != null && drive.collection_lng != null && (
                  <span className="text-[11px] font-mono text-ink-muted block mt-0.5">
                    ({drive.collection_lat.toFixed(5)}, {drive.collection_lng.toFixed(5)})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              {collectionDirectionsUrl && (
                <a
                  href={collectionDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-brand-600 hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Directions to Collection Hub ↗</span>
                </a>
              )}
              {destinationDirectionsUrl && (
                <a
                  href={destinationDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-ink-muted hover:underline font-medium inline-flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Directions to Camp ↗</span>
                </a>
              )}
            </div>
          </div>
        </Card>

        {/* Collection Capacity Progress */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-3">
          <div className="flex items-center justify-between text-body">
            <span className="font-semibold text-navy-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Vehicle Capacity & Progress
            </span>
            <span className="text-caption font-bold text-brand-600">
              {Math.round(progressRatio * 100)}%
            </span>
          </div>

          <ProgressBar value={progressRatio} color="brand" size="md" />

          <div className="flex items-center justify-between text-caption text-ink-muted">
            <span>{totalCollectedUnits} units collected</span>
            <span>{capacityKg} kg capacity ({drive.vehicle_type})</span>
          </div>
        </Card>

        {/* Required Items & Target Table */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <h2 className="text-body font-semibold text-navy-900">Required Supplies & Fulfillment</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-caption">
              <thead>
                <tr className="border-b border-slate-200 text-ink-muted font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 px-2 text-right">Target</th>
                  <th className="py-2 px-2 text-right">Pledged</th>
                  <th className="py-2 px-2 text-right">Accepted</th>
                  <th className="py-2 pl-2 text-right">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-ink">
                {Object.entries(itemQuantities).map(([name, stats]) => (
                  <tr key={name} className="hover:bg-slate-50/50">
                    <td className="py-2.5 pr-2 font-medium text-navy-900">{name}</td>
                    <td className="py-2.5 px-2 text-right text-ink-muted">
                      {stats.target > 0 ? `${stats.target} ${stats.unit}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right text-ink">{stats.pledged}</td>
                    <td className="py-2.5 px-2 text-right font-medium text-brand-600">
                      {stats.accepted}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-bold text-success">
                      {stats.collected}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Logistics & Guidelines */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-3.5">
          <h2 className="text-body font-semibold text-navy-900 border-b border-slate-100 pb-2.5">
            Logistics & Guidelines
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Departure Date
              </span>
              <span className="text-body font-semibold text-navy-900 mt-0.5">
                {drive.departure_date}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                Deadline
              </span>
              <span className="text-body font-semibold text-navy-900 mt-0.5">
                {drive.deadline ? new Date(drive.deadline).toLocaleDateString('en-GB') : 'Open'}
              </span>
            </div>
          </div>

          {/* Pickup Availability Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-card p-3 flex flex-col gap-1">
            <span className="text-caption font-semibold text-navy-900">Pickup Logistics:</span>
            {drive.pickup_enabled ? (
              <p className="text-caption text-ink">
                Volunteer pickup is available for donors within a{' '}
                <strong className="text-brand-600">{drive.pickup_radius_km || 15} km radius</strong> of the
                collection hub. Pickups require organizer confirmation.
              </p>
            ) : (
              <p className="text-caption text-ink-muted">
                No pickup available. Please deliver your donation to the collection point.
              </p>
            )}
          </div>

          {/* Accepted / Unaccepted */}
          {drive.accepted_items && drive.accepted_items.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Accepted Items:
              </span>
              <p className="text-caption text-ink pl-4.5">{drive.accepted_items.join(', ')}</p>
            </div>
          )}

          {drive.unaccepted_items && drive.unaccepted_items.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-danger flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                Explicitly Unaccepted:
              </span>
              <p className="text-caption text-danger pl-4.5 font-medium">{drive.unaccepted_items.join(', ')}</p>
            </div>
          )}

          {drive.instructions && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-card p-3 text-caption text-ink">
              <strong>Instructions:</strong> {drive.instructions}
            </div>
          )}
        </Card>

        {/* Organizer info */}
        <Card className="p-5 border border-slate-200 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-caption shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-wider text-ink-muted font-semibold">
                Organized by
              </p>
              <p className="text-body font-semibold text-navy-900 leading-tight">
                {drive.organizer_name || drive.collector_name || 'Community Organizer'}
              </p>
              <div className="mt-1">
                {drive.allow_calls === false ? (
                  <span className="text-[11px] text-ink-muted flex items-center gap-1">
                    <PhoneOff className="w-3 h-3 text-ink-muted" />
                    Direct calling disabled by organizer
                  </span>
                ) : drive.organizer_contact ? (
                  <a
                    href={`tel:${drive.organizer_contact}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80 text-[12px] font-semibold transition-colors active:scale-95 shadow-2xs select-none"
                  >
                    <Phone className="w-3 h-3 text-brand-600" />
                    <span>Call Organizer</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-success" />
        </Card>

        {/* Two-Step Delivery Verification Status Card */}
        {(drive.status === 'dispatched' ||
          drive.status === 'delivered' ||
          drive.status === 'receipt_confirmed') && (
          <Card className="p-5 border-2 border-brand-600/30 bg-brand-50/40 rounded-xl shadow-card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-body font-bold text-navy-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-brand-600" />
                Two-Step Delivery Verification
              </h3>
            </div>

            <div className="space-y-2 text-caption">
              {/* Step 1: Dispatched */}
              <div className="flex items-center gap-2 text-ink">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
                <span>
                  <strong>Step 1 (Dispatched):</strong> Supplies packed and departed from hub.
                  {drive.dispatched_at && ` (${new Date(drive.dispatched_at).toLocaleDateString()})`}
                </span>
              </div>

              {/* Step 2A: Delivered by Driver */}
              <div className="flex items-center gap-2 text-ink">
                {drive.status === 'delivered' || drive.status === 'receipt_confirmed' ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-600" />
                ) : (
                  <Clock className="w-4 h-4 text-ink-muted" />
                )}
                <span>
                  <strong>Step 2A (Arrival):</strong>{' '}
                  {drive.delivered_at
                    ? `Driver arrived at camp on ${new Date(drive.delivered_at).toLocaleDateString()}`
                    : 'Awaiting driver arrival at destination camp'}
                </span>
              </div>

              {/* Step 2B: Recipient Confirmation */}
              <div className="flex items-center gap-2 text-ink">
                {drive.status === 'receipt_confirmed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-600" />
                )}
                <span>
                  <strong>Step 2B (Receipt Confirmation):</strong>{' '}
                  {drive.status === 'receipt_confirmed' ? (
                    <span className="text-emerald-800 font-semibold">
                      Officially confirmed received by {drive.recipient_name}
                      {drive.recipient_contact ? ` (${drive.recipient_contact})` : ''} ✓
                    </span>
                  ) : (
                    <span className="text-amber-800 font-medium">
                      Awaiting recipient / camp representative confirmation
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Recipient Confirmation Action Button (Accessible to receiving representatives) */}
            {drive.status === 'delivered' && (
              <div className="pt-2">
                <Button
                  variant="primary"
                  onClick={() => setIsConfirmReceiptModalOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Confirm Receipt of Supplies (Camp Representative)
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Public Donor List */}
        <Card data-testid="public-donor-card" className="p-5 border border-slate-200 shadow-card flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-body font-semibold text-navy-900">Community Donor List</h2>
              <p className="text-[12px] text-ink-muted">Supplies pledged by the community</p>
            </div>
            <span className="text-[12px] font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-pill">
              {publicContribs.length} Donors
            </span>
          </div>

          {publicContribs.length === 0 ? (
            <p className="text-caption text-ink-muted text-center py-4">
              No contributions recorded yet. Be the first to contribute to this drive!
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {publicContribs.map(contrib => (
                <div
                  key={contrib.id}
                  className="bg-slate-50 border border-slate-200/80 p-3 rounded-card flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-brand-600 flex items-center justify-center font-bold text-[12px]">
                      {contrib.is_anonymous ? <EyeOff className="w-4 h-4 text-ink-muted" /> : contrib.donor_display_name[0]}
                    </div>
                    <div>
                      <span className="text-body font-semibold text-navy-900 block leading-tight">
                        {contrib.donor_display_name}
                      </span>
                      <span className="text-caption text-ink-muted block mt-0.5">
                        {contrib.items.map(i => `${i.quantity} ${i.unit} ${i.item_name}`).join(', ')}
                      </span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-pill capitalize',
                      contrib.status === 'collected' || contrib.status === 'receipt_confirmed'
                        ? 'bg-success-bg text-success'
                        : contrib.status === 'accepted'
                        ? 'bg-brand-100 text-brand-600'
                        : 'bg-slate-200/80 text-ink-muted'
                    )}
                  >
                    {contrib.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Organizer Management Dashboard (Phase 2.E & H) */}
        {isOrganizer && (
          <Card className="p-5 border-2 border-brand-600/40 bg-brand-50/20 shadow-card flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-brand-200/60 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                <h2 className="text-body font-bold text-navy-900">Organizer Management Panel</h2>
              </div>
              <span className="text-[11px] font-bold text-brand-600 bg-brand-100 px-2 py-0.5 rounded-pill">
                Organizer Only
              </span>
            </div>

            {/* Two-step logistics action triggers */}
            <div className="flex flex-wrap gap-2">
              {drive.status === 'open' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsDispatchModalOpen(true)}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-medium flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch supplies vehicle</span>
                </Button>
              )}

              {drive.status === 'dispatched' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsDeliverModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Record arrival at destination camp</span>
                </Button>
              )}
            </div>

            {/* Manage Individual Contributions */}
            <h3 className="text-caption font-bold text-navy-900 uppercase tracking-wider mt-1">
              Review & Manage Contributions ({contributions.length})
            </h3>

            {contributions.length === 0 ? (
              <p className="text-caption text-ink-muted">No donor contributions submitted yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {contributions.map(contrib => (
                  <div
                    key={contrib.id}
                    className="p-3.5 rounded-card bg-white border border-slate-200 flex flex-col gap-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-navy-900 text-body">
                            {contrib.donor_name}
                          </span>
                          {contrib.is_anonymous && (
                            <span className="text-[10px] bg-slate-100 text-ink-muted px-1.5 py-0.5 rounded font-medium">
                              Anonymous to public
                            </span>
                          )}
                        </div>
                        {contrib.donor_contact && (
                          <span className="text-caption text-brand-600 font-medium block">
                            Contact: {contrib.donor_contact}
                          </span>
                        )}
                        <span className="text-caption text-ink-muted block mt-0.5">
                          Method: <strong>{contrib.delivery_method.replace('_', ' ')}</strong>
                          {contrib.distance_km != null && ` (${contrib.distance_km} km away)`}
                        </span>
                      </div>

                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill bg-slate-100 text-ink">
                        {contrib.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Donor Address (visible only to organizer for accepted pickups) */}
                    {contrib.donor_address && (
                      <div className="bg-slate-50 border border-slate-200/80 p-2 rounded text-[12px] text-ink">
                        <strong>Pickup Address:</strong> {contrib.donor_address}
                      </div>
                    )}

                    {/* Items */}
                    <div className="text-caption text-navy-900 font-medium">
                      Items: {contrib.items.map(i => `${i.quantity} ${i.unit} ${i.item_name}`).join(', ')}
                    </div>

                    {/* Actions for Organizer */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
                      {contrib.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() =>
                              handleUpdateStatus(
                                contrib.id,
                                contrib.delivery_method === 'pickup' ? 'collection_arranged' : 'accepted'
                              )
                            }
                            className="bg-brand-600 text-white text-xs h-8"
                          >
                            Accept Contribution
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUpdateStatus(contrib.id, 'declined')}
                            className="text-danger border-red-200 text-xs h-8"
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {(contrib.status === 'accepted' || contrib.status === 'collection_arranged') && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleUpdateStatus(contrib.id, 'collected')}
                          className="bg-success text-white text-xs h-8"
                        >
                          Mark Collected / Received
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Bottom Floating Action Button to Contribute */}
        {drive.status === 'open' && (
          <div className="fixed bottom-16 left-0 right-0 p-4 bg-surface/90 backdrop-blur-md border-t border-slate-200 z-20 max-w-xl mx-auto flex items-center justify-center">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => setIsContributeModalOpen(true)}
              leftIcon={<Package className="w-5 h-5 shrink-0" />}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 shadow-lg flex items-center justify-center gap-2"
            >
              <span className="whitespace-nowrap sm:whitespace-normal">Contribute supplies to this drive</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── Contribute Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={isContributeModalOpen}
        onClose={() => setIsContributeModalOpen(false)}
        title="Contribute Supplies"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleContributeSubmit} className="space-y-4">
          <p className="text-caption text-ink-muted -mt-2">
            Select items you can donate to the {drive.from_city} → {drive.to_city} collection drive.
          </p>

          <Input
            id="donor-name"
            label="Your Name *"
            placeholder="e.g. Ramesh Kumar"
            value={donorName}
            onChange={e => setDonorName(e.target.value)}
            error={formErrors.donorName}
          />

          <Input
            id="donor-contact"
            label="Phone / WhatsApp Contact"
            placeholder="e.g. +91 98765 43210"
            value={donorContact}
            onChange={e => setDonorContact(e.target.value)}
          />

          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-card">
            <input
              type="checkbox"
              id="is-anon"
              checked={isAnonymous}
              onChange={e => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-slate-300"
            />
            <label htmlFor="is-anon" className="text-caption font-medium text-ink cursor-pointer">
              Keep my name anonymous on the public donor list
            </label>
          </div>

          {/* Item Selection from Drive Targets */}
          <div className="space-y-2">
            <label className="text-caption font-semibold text-navy-900 block">
              Select Items to Donate *
            </label>
            {drive.target_items && drive.target_items.length > 0 ? (
              <div className="space-y-2">
                {drive.target_items.map(target => (
                  <div
                    key={target.name}
                    className="flex items-center justify-between p-3 rounded-card border border-slate-200 bg-white"
                  >
                    <div>
                      <span className="text-body font-semibold text-navy-900 block">{target.name}</span>
                      <span className="text-[12px] text-ink-muted">
                        Target: {target.target_quantity} {target.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={selectedItems[target.name] || ''}
                        onChange={e =>
                          setSelectedItems(prev => ({
                            ...prev,
                            [target.name]: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-20 h-9 px-2.5 rounded border border-slate-300 text-center text-body text-ink focus:border-brand-600 focus:outline-none"
                      />
                      <span className="text-caption text-ink-muted">{target.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Custom Item Row */}
            <div className="p-3 rounded-card bg-slate-50 border border-dashed border-slate-300 space-y-2">
              <span className="text-[12px] font-semibold text-ink-muted uppercase tracking-wider block">
                + Or Donate Another Item
              </span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Item name"
                  value={customItemName}
                  onChange={e => setCustomItemName(e.target.value)}
                  className="col-span-1 h-9 px-2.5 rounded border border-slate-300 text-caption text-ink bg-white focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  min="1"
                  value={customItemQty}
                  onChange={e => setCustomItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="col-span-1 h-9 px-2.5 rounded border border-slate-300 text-caption text-ink bg-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Unit (pcs, kg)"
                  value={customItemUnit}
                  onChange={e => setCustomItemUnit(e.target.value)}
                  className="col-span-1 h-9 px-2.5 rounded border border-slate-300 text-caption text-ink bg-white focus:outline-none"
                />
              </div>
            </div>

            {formErrors.items && <p className="text-caption text-danger">{formErrors.items}</p>}
          </div>

          {/* Delivery Method Choice */}
          <div className="space-y-2">
            <label className="text-caption font-semibold text-navy-900 block">
              Delivery Method *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMethod('self_delivery')}
                className={cn(
                  'p-3 rounded-card border text-left transition-all',
                  deliveryMethod === 'self_delivery'
                    ? 'border-brand-600 bg-brand-50/50 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <span className="text-caption font-semibold text-navy-900 block">Self-Delivery</span>
                <span className="text-[11px] text-ink-muted block mt-0.5">
                  Drop off at the collection hub
                </span>
              </button>

              <button
                type="button"
                disabled={!drive.pickup_enabled && !drive.allow_pickup}
                onClick={() => setDeliveryMethod('pickup')}
                className={cn(
                  'p-3 rounded-card border text-left transition-all',
                  deliveryMethod === 'pickup'
                    ? 'border-brand-600 bg-brand-50/50 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50',
                  !drive.pickup_enabled && !drive.allow_pickup && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="text-caption font-semibold text-navy-900 block">Volunteer Pickup</span>
                <span className="text-[11px] text-ink-muted block mt-0.5">
                  {drive.pickup_enabled ? `Within ${drive.pickup_radius_km || 15} km radius` : 'Not available'}
                </span>
              </button>
            </div>
            {formErrors.deliveryMethod && (
              <p className="text-caption text-danger">{formErrors.deliveryMethod}</p>
            )}
          </div>

          {/* Pickup Address & Map Pin */}
          {deliveryMethod === 'pickup' && (
            <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold text-navy-900">Your Pickup Address *</span>
                <span className="text-[11px] text-brand-600 font-medium">Exact Coordinates</span>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddressModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-brand-600" />
                <span>{donorLat ? 'Change pinned pickup location' : 'Pin your address on map *'}</span>
              </Button>

              {donorAddress && (
                <div className="text-caption text-ink font-medium bg-white p-2.5 rounded border border-slate-200">
                  <div className="truncate">{donorAddress}</div>
                  {calculatedDistance !== null && (
                    <div className="text-[11px] text-ink-muted mt-1">
                      Distance to hub: <strong>{calculatedDistance.toFixed(1)} km</strong> (Max: {drive.pickup_radius_km} km)
                    </div>
                  )}
                </div>
              )}

              {calculatedDistance !== null && !isPickupEligible && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-caption text-danger font-medium flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Your location is {calculatedDistance.toFixed(1)} km away. No pickup available. Please deliver your donation to the collection point.
                  </span>
                </div>
              )}

              {formErrors.donorAddress && (
                <p className="text-caption text-danger">{formErrors.donorAddress}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="donor-notes" className="text-caption font-semibold text-ink">
              Notes for Organizer
            </label>
            <textarea
              id="donor-notes"
              rows={2}
              placeholder="e.g. Can drop off after 5 PM, items are boxed"
              value={donorNotes}
              onChange={e => setDonorNotes(e.target.value)}
              className="w-full rounded-input bg-surface-low border border-slate-300 p-2.5 text-caption text-ink focus:outline-none focus:border-brand-600"
            />
          </div>

          <div className="flex items-center gap-2 pt-3 sticky bottom-0 bg-surface pb-1 border-t border-slate-100 mt-2 z-10 shadow-sm">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsContributeModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createContribution.isPending}
              disabled={deliveryMethod === 'pickup' && !isPickupEligible}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold"
            >
              Submit Contribution
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Dispatch Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Dispatch Supplies Vehicle"
      >
        <div className="space-y-4">
          <p className="text-caption text-ink">
            Confirm that collected supplies have been packed and the vehicle is departing for{' '}
            <strong>{drive.to_city}</strong> ({drive.destination_camp || drive.destination_event}).
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="disp-notes" className="text-caption font-semibold text-ink">
              Vehicle / Driver Notes (Optional)
            </label>
            <textarea
              id="disp-notes"
              rows={2}
              placeholder="e.g. Driver Murugan (TN 38 AB 1234), leaving Erode 8:00 AM"
              value={dispatchNotes}
              onChange={e => setDispatchNotes(e.target.value)}
              className="w-full rounded-input border border-slate-300 p-2.5 text-caption text-ink"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsDispatchModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDispatch}
              isLoading={dispatchDriveMut.isPending}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold"
            >
              Confirm Dispatch
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delivered Modal (Step 2A) ────────────────────────────────────────── */}
      <Modal
        isOpen={isDeliverModalOpen}
        onClose={() => setIsDeliverModalOpen(false)}
        title="Record Arrival at Relief Camp"
      >
        <div className="space-y-4">
          <p className="text-caption text-ink">
            Mark that the vehicle has arrived at destination{' '}
            <strong>{drive.destination_camp || drive.to_city}</strong>.
            The shipment will show "Awaiting recipient confirmation" until the camp coordinator confirms receipt.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="del-notes" className="text-caption font-semibold text-ink">
              Arrival Notes (Optional)
            </label>
            <textarea
              id="del-notes"
              rows={2}
              placeholder="e.g. Unloaded at gate 3, received by volunteer team"
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              className="w-full rounded-input border border-slate-300 p-2.5 text-caption text-ink"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsDeliverModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleMarkDelivered}
              isLoading={markDeliveredMut.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Record Arrival
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm Receipt Modal (Step 2B) ─────────────────────────────────── */}
      <Modal
        isOpen={isConfirmReceiptModalOpen}
        onClose={() => setIsConfirmReceiptModalOpen(false)}
        title="Confirm Receipt of Supplies"
      >
        <div className="space-y-4">
          <p className="text-caption text-ink">
            As a receiving representative or relief camp coordinator, confirm that the supplies from this collection drive were physically received.
          </p>

          <Input
            id="rec-name"
            label="Representative Full Name *"
            placeholder="e.g. Dr. Priya S, Relief Camp Officer"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
          />

          <Input
            id="rec-contact"
            label="Contact Phone"
            placeholder="e.g. +91 94432 11223"
            value={recipientContact}
            onChange={e => setRecipientContact(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rec-notes" className="text-caption font-semibold text-ink">
              Confirmation / Acknowledgment Notes
            </label>
            <textarea
              id="rec-notes"
              rows={2}
              placeholder="e.g. All 100 blankets and water boxes received in good condition"
              value={recipientNotes}
              onChange={e => setRecipientNotes(e.target.value)}
              className="w-full rounded-input border border-slate-300 p-2.5 text-caption text-ink"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsConfirmReceiptModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmReceipt}
              isLoading={confirmReceiptMut.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Confirm Official Receipt ✓
            </Button>
          </div>
        </div>
      </Modal>

      {/* Location Picker for Donor Pickup */}
      <LocationPickerModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onConfirm={handleMapConfirmDonor}
        initialLat={donorLat || drive.collection_lat || undefined}
        initialLng={donorLng || drive.collection_lng || undefined}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} visible={Boolean(toastMessage)} variant={toastVariant} />
    </AppShell>
  )
}
