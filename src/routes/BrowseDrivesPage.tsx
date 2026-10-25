import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import {
  Truck,
  Plus,
  Calendar,
  MapPin,
  PackageOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useDrives } from '@/hooks/useDrives'
import { normalizeSearchQuery } from '@/lib/gemini'
import { cn } from '@/utils/cn'

export function BrowseDrivesPage() {
  const navigate = useNavigate()
  const { data: drives = [], isLoading, isError, refetch } = useDrives()

  const [searchTerm, setSearchTerm] = useState('')
  const [normalizedSearch, setNormalizedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pickupFilter, setPickupFilter] = useState<string>('all')

  const handleSearchChange = async (val: string) => {
    setSearchTerm(val)
    if (!val.trim()) {
      setNormalizedSearch('')
      return
    }
    const norm = await normalizeSearchQuery(val)
    setNormalizedSearch(norm.toLowerCase())
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    } catch {
      return dateStr
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'receipt_confirmed':
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-emerald-100 text-emerald-800 border border-emerald-300">
            Receipt Confirmed ✓
          </span>
        )
      case 'delivered':
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-blue-100 text-blue-800 border border-blue-200">
            Delivered to Camp
          </span>
        )
      case 'dispatched':
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-amber-100 text-amber-800 border border-amber-200">
            In Transit / Dispatched
          </span>
        )
      case 'collection_in_progress':
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-purple-100 text-purple-800 border border-purple-200">
            Collecting Supplies
          </span>
        )
      default:
        return (
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-success-bg text-success uppercase tracking-wider">
            Open for Donations
          </span>
        )
    }
  }

  const filteredDrives = useMemo(() => {
    return drives.filter(drive => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'open' && drive.status !== 'open') return false
        if (statusFilter === 'dispatched' && drive.status !== 'dispatched') return false
        if (statusFilter === 'delivered' && drive.status !== 'delivered') return false
        if (statusFilter === 'receipt_confirmed' && drive.status !== 'receipt_confirmed') return false
      }

      // Pickup filter
      if (pickupFilter === 'pickup' && !drive.pickup_enabled && !drive.allow_pickup) return false
      if (pickupFilter === 'dropoff_only' && (drive.pickup_enabled || drive.allow_pickup)) return false

      // Search matching (city, title, destination event, needed items, accepted items)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const norm = normalizedSearch || query

        const matchesRaw =
          drive.from_city.toLowerCase().includes(query) ||
          drive.to_city.toLowerCase().includes(query) ||
          (drive.destination_event && drive.destination_event.toLowerCase().includes(query)) ||
          (drive.title && drive.title.toLowerCase().includes(query)) ||
          (drive.collection_location && drive.collection_location.toLowerCase().includes(query)) ||
          drive.needs.some(n => n.toLowerCase().includes(query))

        const matchesNorm =
          norm !== query &&
          (drive.needs.some(n => n.toLowerCase().includes(norm)) ||
            (drive.accepted_items && drive.accepted_items.some(i => i.toLowerCase().includes(norm))))

        if (!matchesRaw && !matchesNorm) return false
      }

      return true
    })
  }, [drives, statusFilter, pickupFilter, searchTerm, normalizedSearch])

  return (
    <AppShell>
      <TopBar title="Collection Drives" variant="navy" />
      <div className="pt-16 pb-24 max-w-2xl mx-auto flex flex-col gap-5 w-full min-w-0">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-h2 font-bold text-navy-900 tracking-tight">Collection Drives</h1>
            <p className="text-caption text-ink-muted mt-0.5">
              Community volunteer hubs collecting and transporting relief supplies
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/drives/create')}
            className="self-start sm:self-auto shrink-0 bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Start a drive</span>
          </Button>
        </div>

        {/* Search Bar with AI Semantic Normalization */}
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          <div className="relative flex items-center w-full">
            <Search className="absolute left-3 w-4 h-4 text-ink-muted pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search by city, camp, or supply (e.g. Chennai, blankets, thanni)…"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface border border-slate-200 text-body text-ink placeholder:text-ink-muted transition-all focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 shadow-sm"
            />
          </div>
          {normalizedSearch && normalizedSearch !== searchTerm.toLowerCase() && (
            <div className="flex items-center gap-1.5 text-[12px] text-brand-600 font-medium pl-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Showing results normalized to: <strong>"{normalizedSearch}"</strong></span>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-caption scrollbar-none w-full max-w-full min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 text-ink-muted font-medium mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'open', label: 'Open' },
            { id: 'dispatched', label: 'In Transit' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'receipt_confirmed', label: 'Confirmed ✓' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-pill font-medium transition-all shrink-0 border',
                statusFilter === f.id
                  ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                  : 'bg-surface border-slate-200 text-ink hover:bg-slate-50'
              )}
            >
              {f.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 shrink-0 mx-1" />

          {[
            { id: 'all', label: 'All Logistics' },
            { id: 'pickup', label: 'Pickup Available' },
            { id: 'dropoff_only', label: 'Drop-off Only' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPickupFilter(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-pill font-medium transition-all shrink-0 border',
                pickupFilter === p.id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-surface border-slate-200 text-ink hover:bg-slate-50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <PageSpinner label="Loading collection drives…" />
        ) : isError ? (
          <Card className="p-8 text-center flex flex-col items-center gap-3">
            <p className="text-body font-semibold text-danger">Failed to load drives</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </Card>
        ) : filteredDrives.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center gap-4 bg-surface/50">
            <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
              <PackageOpen className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-h3 font-semibold text-navy-900">No collection drives match your search</h2>
              <p className="text-caption text-ink-muted max-w-sm">
                Try clearing your search filters or start a new collection drive to mobilize donations in your area.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate('/drives/create')}
              className="bg-brand-600 hover:bg-brand-700 text-white"
            >
              Start a collection drive
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3.5">
            {filteredDrives.map(drive => (
              <Card
                key={drive.id}
                as="div"
                noPadding
                onClick={() => navigate(`/drives/${drive.id}`)}
                className="p-4 rounded-xl border border-slate-200 bg-surface hover:border-brand-600 hover:shadow-md transition-all cursor-pointer flex flex-col gap-3 group active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-semibold text-navy-900 group-hover:text-brand-600 transition-colors">
                        {drive.title || `${drive.from_city} → ${drive.to_city}`}
                      </h3>
                      <p className="text-caption text-ink-muted">
                        For: <span className="font-semibold text-ink">{drive.destination_event}</span>
                        {drive.destination_camp && ` · ${drive.destination_camp}`}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">{getStatusBadge(drive.status)}</div>
                </div>

                {/* Collection Hub */}
                {drive.collection_location && (
                  <div className="flex items-center gap-1.5 text-caption text-ink font-medium bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    <span className="truncate">Hub: {drive.collection_location}</span>
                  </div>
                )}

                {/* Logistics Info Bar */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted border-t border-slate-100 pt-2.5">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    Departs: {formatDate(drive.departure_date)}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    {drive.vehicle_type} · {drive.capacity_kg} kg capacity
                  </span>

                  {drive.pickup_enabled ? (
                    <span className="text-[11px] font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-pill border border-brand-200">
                      Pickup up to {drive.pickup_radius_km || 15} km
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-ink-muted bg-slate-100 px-2 py-0.5 rounded-pill">
                      Drop-off only
                    </span>
                  )}
                </div>

                {/* Needed Items Chips */}
                {drive.needs && drive.needs.length > 0 && (
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-ink-muted">Needed:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {drive.needs.map(need => (
                        <span
                          key={need}
                          className="text-[11px] font-medium bg-surface-low border border-slate-200 text-ink px-2.5 py-0.5 rounded-pill"
                        >
                          {need}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
