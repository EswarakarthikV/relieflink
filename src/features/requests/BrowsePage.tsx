import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  ClipboardList,
  Heart,
  Truck,
  MapPin,
  Calendar,
  ArrowRight,
  ExternalLink,
  Package,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardSkeleton } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge, UrgencyBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { RequestCard } from './RequestCard'
import { MakeOfferSheet } from '@/features/offers/MakeOfferSheet'
import { useRequests } from '@/hooks/useRequests'
import { useDrives } from '@/hooks/useDrives'
import { normalizeSearchQuery } from '@/lib/gemini'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import type { UrgencyLevel, CollectionDrive } from '@/types'
import { relativeTime, fmtNumber } from '@/utils/format'
import { cn } from '@/utils/cn'

export type BrowseSection = 'all' | 'requests' | 'donations' | 'drives' | 'nearby'

export interface DonationItem {
  id: string
  quantity_offered: number
  unit: string
  status: 'pending' | 'accepted' | 'dispatched' | 'delivered'
  item_name: string
  request_id: string
  request_title: string
  donor_name: string
  created_at: string
}

const MOCK_DONATIONS: DonationItem[] = []

type UrgencyChip = 'all' | UrgencyLevel | 'open'

const URGENCY_CHIPS: { id: UrgencyChip; label: string }[] = [
  { id: 'all',      label: 'All Urgencies' },
  { id: 'critical', label: '🔴 Critical' },
  { id: 'high',     label: '🟠 High' },
  { id: 'open',     label: 'Open' },
  { id: 'medium',   label: 'Medium' },
  { id: 'low',      label: 'Low' },
]

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialType = searchParams.get('type') || searchParams.get('tab') || 'all'

  const [activeSection, setActiveSection] = useState<BrowseSection>(() => {
    if (initialType === 'donations') return 'donations'
    if (initialType === 'drives') return 'drives'
    if (initialType === 'requests') return 'requests'
    if (initialType === 'near_me' || initialType === 'nearby') return 'nearby'
    return 'all'
  })

  // Sync section with query parameter if present
  useEffect(() => {
    const t = searchParams.get('type') || searchParams.get('tab')
    if (t === 'donations') setActiveSection('donations')
    else if (t === 'drives') setActiveSection('drives')
    else if (t === 'requests') setActiveSection('requests')
    else if (t === 'nearby' || t === 'near_me') setActiveSection('nearby')
  }, [searchParams])

  const [search, setSearch] = useState('')
  const [normalizedQuery, setNormalizedQuery] = useState('')
  const [isNormalizing, setIsNormalizing] = useState(false)
  const [translatedWord, setTranslatedWord] = useState<string | null>(null)
  const [activeUrgencyChip, setActiveUrgencyChip] = useState<UrgencyChip>('all')
  // Active request for direct supply offering modal
  const [selectedOfferRequest, setSelectedOfferRequest] = useState<any | null>(null)

  const latestSearchRef = useRef(search)
  latestSearchRef.current = search

  // Debounced search normalizer (500ms)
  useEffect(() => {
    const raw = search.trim()
    if (!raw) {
      setNormalizedQuery('')
      setTranslatedWord(null)
      setIsNormalizing(false)
      return
    }

    if (raw.length <= 2) {
      setNormalizedQuery(raw)
      setTranslatedWord(null)
      setIsNormalizing(false)
      return
    }

    setIsNormalizing(true)

    const timer = setTimeout(async () => {
      try {
        const normalized = await normalizeSearchQuery(raw)
        if (latestSearchRef.current.trim() === raw) {
          setNormalizedQuery(normalized)
          if (normalized.toLowerCase() !== raw.toLowerCase()) {
            setTranslatedWord(normalized)
          } else {
            setTranslatedWord(null)
          }
        }
      } catch (err) {
        console.warn('AI search normalization fallback:', err)
        if (latestSearchRef.current.trim() === raw) {
          setNormalizedQuery(raw)
          setTranslatedWord(null)
        }
      } finally {
        if (latestSearchRef.current.trim() === raw) {
          setIsNormalizing(false)
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [search])

  // 1. Requests
  const { data: requestsData, isLoading: isRequestsLoading } = useRequests()
  const allRequests = requestsData?.data ?? []

  // 2. Drives
  const { data: allDrives = [], isLoading: isDrivesLoading } = useDrives()

  // 3. Donations
  const { data: allDonations = [], isLoading: isDonationsLoading } = useQuery<DonationItem[]>({
    queryKey: ['browse_donations'],
    queryFn: async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('offers')
            .select(`
              id,
              quantity_offered,
              status,
              created_at,
              request_items (
                item_name,
                unit
              ),
              requests (
                id,
                title
              ),
              profiles:donor_id (
                full_name
              )
            `)
            .not('status', 'in', '("cancelled","rejected")')
            .order('created_at', { ascending: false })

          if (!error && data) {
            return data
              .filter((row: any) => !row.requests?.title?.startsWith('Automated QA ') && !row.requests?.title?.startsWith('[TEST]'))
              .map((row: any): DonationItem => ({
              id: row.id,
              quantity_offered: Number(row.quantity_offered) || 0,
              unit: row.request_items?.unit || 'units',
              status: row.status,
              item_name: row.request_items?.item_name || 'Supply item',
              request_id: row.requests?.id || '',
              request_title: row.requests?.title || 'Relief Request',
              donor_name: row.profiles?.full_name || 'Anonymous Donor',
              created_at: row.created_at,
            }))
          }
        } catch (err) {
          console.warn('Error querying donations in browse:', err)
        }
      }
      return []
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const isLoading = isRequestsLoading || isDrivesLoading || isDonationsLoading

  const activeSearchTerm = (normalizedQuery || search).trim().toLowerCase()
  const rawQ = search.trim().toLowerCase()

  // Filter Requests
  const filteredRequests = useMemo(() => {
    return allRequests.filter(req => {
      const matchSearch =
        !activeSearchTerm ||
        req.title.toLowerCase().includes(activeSearchTerm) ||
        req.title.toLowerCase().includes(rawQ) ||
        (req.city && (req.city.toLowerCase().includes(activeSearchTerm) || req.city.toLowerCase().includes(rawQ))) ||
        req.location.toLowerCase().includes(activeSearchTerm) ||
        req.location.toLowerCase().includes(rawQ) ||
        (req.items && req.items.some(it =>
          it.name.toLowerCase().includes(activeSearchTerm) ||
          it.name.toLowerCase().includes(rawQ) ||
          (it.category && (it.category.toLowerCase().includes(activeSearchTerm) || it.category.toLowerCase().includes(rawQ)))
        ))

      const matchUrgency =
        activeUrgencyChip === 'all' ? true :
        activeUrgencyChip === 'open' ? req.status === 'open' :
        req.urgency === activeUrgencyChip

      const matchNearby = activeSection === 'nearby' ? (req.distanceKm ?? 999) <= 15 : true

      return matchSearch && matchUrgency && matchNearby
    })
  }, [allRequests, activeSearchTerm, rawQ, activeUrgencyChip, activeSection])

  // Filter Donations
  const filteredDonations = useMemo(() => {
    return allDonations.filter(don => {
      if (activeSection === 'nearby') return false // Donations don't have direct coordinate tags in browse
      const matchSearch =
        !activeSearchTerm ||
        don.item_name.toLowerCase().includes(activeSearchTerm) ||
        don.item_name.toLowerCase().includes(rawQ) ||
        don.donor_name.toLowerCase().includes(activeSearchTerm) ||
        don.request_title.toLowerCase().includes(activeSearchTerm)
      return matchSearch
    })
  }, [allDonations, activeSearchTerm, rawQ, activeSection])

  // Filter Drives
  const filteredDrives = useMemo(() => {
    return allDrives.filter(drive => {
      const title = (drive.title || '').toLowerCase()
      const fromCity = (drive.from_city || '').toLowerCase()
      const matchSearch =
        !activeSearchTerm ||
        title.includes(activeSearchTerm) ||
        title.includes(rawQ) ||
        fromCity.includes(activeSearchTerm) ||
        (drive.destination_city && drive.destination_city.toLowerCase().includes(activeSearchTerm)) ||
        (drive.to_city && drive.to_city.toLowerCase().includes(activeSearchTerm)) ||
        (drive.target_items && drive.target_items.some(ti => (ti.name || '').toLowerCase().includes(activeSearchTerm)))

      const matchNearby = activeSection === 'nearby'
        ? (fromCity.includes('pune') || fromCity.includes('mumbai'))
        : true

      return matchSearch && matchNearby
    })
  }, [allDrives, activeSearchTerm, rawQ, activeSection])

  const handleSectionChange = (section: BrowseSection) => {
    setActiveSection(section)
    if (section === 'all') {
      setSearchParams({})
    } else {
      setSearchParams({ type: section })
    }
  }

  return (
    <AppShell>
      <TopBar title="Browse Aid & Logistics" variant="navy" />

      {/* Sticky search + filter console */}
      <div className="sticky top-16 z-40 bg-surface shadow-sm pt-3 pb-2 px-4 border-b border-slate-200/80">
        {/* Search input */}
        <div className="h-12 bg-surface-low rounded-input px-3 flex items-center gap-2.5 focus-within:shadow-[0_0_0_2px_#2563EB] transition-shadow border border-slate-200/80">
          {isNormalizing ? (
            <Spinner size="sm" className="w-5 h-5 text-brand-600 shrink-0" label="Normalizing search query with AI…" />
          ) : (
            <Search className="w-5 h-5 text-ink-muted select-none shrink-0" />
          )}
          <input
            id="browse-search"
            className="w-full bg-transparent border-none outline-none text-body text-ink placeholder:text-ink-muted"
            placeholder="Search requests, donations, drives (e.g. water, blankets, Pune)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            type="button"
            aria-label="Filter"
            className="text-ink-muted hover:text-ink p-1 min-h-touch min-w-[44px] flex items-center justify-center"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Translation Pill if AI translated the query */}
        {translatedWord && !isNormalizing && (
          <div className="mt-1.5 flex items-center gap-1.5 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-pill shadow-xs animate-in fade-in duration-200">
              <Sparkles className="w-3 h-3 text-brand-600" />
              <span>Smart search: <strong>{translatedWord}</strong></span>
            </span>
          </div>
        )}

        {/* ── Segmented Control: All, Requests, Donations, Drives, Near Me ── */}
        <div className="mt-2.5 flex bg-slate-100 p-1 rounded-pill border border-slate-200/80 overflow-x-auto scroll-x">
          <button
            type="button"
            onClick={() => handleSectionChange('all')}
            className={cn(
              'flex-1 min-w-[65px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
              activeSection === 'all'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('requests')}
            className={cn(
              'flex-1 min-w-[90px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
              activeSection === 'requests'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            Requests ({filteredRequests.length})
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('donations')}
            className={cn(
              'flex-1 min-w-[95px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
              activeSection === 'donations'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            Donations ({filteredDonations.length})
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('drives')}
            className={cn(
              'flex-1 min-w-[80px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
              activeSection === 'drives'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            Drives ({filteredDrives.length})
          </button>
          <button
            type="button"
            onClick={() => handleSectionChange('nearby')}
            className={cn(
              'flex-1 min-w-[85px] py-1.5 px-3 rounded-pill text-caption font-semibold transition-all shrink-0 text-center',
              activeSection === 'nearby'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            📍 Near Me
          </button>
        </div>

        {/* Secondary Urgency Chips (visible when on All or Requests tab) */}
        {(activeSection === 'all' || activeSection === 'requests' || activeSection === 'nearby') && (
          <nav aria-label="Filter urgency" className="flex items-center gap-1.5 overflow-x-auto scroll-x pt-2 pb-0.5">
            {URGENCY_CHIPS.map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveUrgencyChip(chip.id)}
                className={cn(
                  'h-7 px-3 rounded-pill text-[11px] font-medium shrink-0',
                  'flex items-center justify-center transition-all active:scale-95',
                  activeUrgencyChip === chip.id
                    ? 'bg-brand-600 text-white font-semibold shadow-xs'
                    : 'bg-surface text-ink-muted hover:text-ink border border-slate-200',
                )}
              >
                {chip.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Guidance banner when routed from Create Menu -> Offer Supplies */}
      {searchParams.get('action') === 'donate' && (
        <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-card flex items-start gap-2.5 shadow-xs">
          <Heart className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-caption font-bold text-emerald-900 leading-tight">
              Select a relief request to offer supplies
            </p>
            <p className="text-[12px] text-emerald-800/80 mt-0.5 leading-snug">
              Choose any open request below and tap <strong>Offer Supplies</strong> or <strong>View details</strong> to pledge your supplies, delivery, or pickup.
            </p>
          </div>
        </div>
      )}

      {/* ── Content Feed ── */}
      <section aria-label="Browse Feed" className="flex flex-col gap-4 px-4 pt-3 pb-24">
        {isLoading ? (
          [0, 1, 2, 3].map(i => <CardSkeleton key={i} />)
        ) : (
          <>
            {/* ── Empty State for All ── */}
            {activeSection === 'all' && filteredRequests.length === 0 && filteredDonations.length === 0 && filteredDrives.length === 0 && (
              <div className="py-16 text-center bg-surface rounded-card border border-slate-200/80 shadow-card p-6">
                <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <p className="text-h3 font-semibold text-ink mb-1">No relief activities found</p>
                <p className="text-caption text-ink-muted max-w-sm mx-auto mb-4">
                  There are currently no active crisis requests, donation offers, or collection drives.
                </p>
                <Link to="/create">
                  <Button variant="primary" size="sm">
                    Create First Request
                  </Button>
                </Link>
              </div>
            )}
            {/* ── 1. REQUESTS SECTION ── */}
            {(activeSection === 'all' || activeSection === 'requests' || activeSection === 'nearby') && (
              <div className="space-y-3">
                {activeSection === 'all' && filteredRequests.length > 0 && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[12px] font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-brand-600" />
                      Active Relief Requests ({filteredRequests.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSectionChange('requests')}
                      className="text-[12px] text-brand-600 font-semibold hover:underline"
                    >
                      View all requests →
                    </button>
                  </div>
                )}

                {activeSection === 'requests' && filteredRequests.length === 0 && (
                  <div className="py-16 text-center bg-surface rounded-card border border-slate-200/80 shadow-card">
                    <p className="text-h3 font-semibold text-ink mb-1">No requests match filters</p>
                    <p className="text-caption text-ink-muted">Try clearing your search term or urgency filters.</p>
                  </div>
                )}

                {(activeSection === 'all' ? filteredRequests.slice(0, 4) : filteredRequests).map(req => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onOfferClick={(r) => setSelectedOfferRequest(r)}
                  />
                ))}
              </div>
            )}

            {/* ── 2. DONATION OFFERS SECTION ── */}
            {(activeSection === 'all' || activeSection === 'donations') && (
              <div className="space-y-3">
                {activeSection === 'all' && filteredDonations.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <span className="text-[12px] font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-brand-600" />
                      Donation Commitments ({filteredDonations.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSectionChange('donations')}
                      className="text-[12px] text-brand-600 font-semibold hover:underline"
                    >
                      View all donations →
                    </button>
                  </div>
                )}

                {activeSection === 'donations' && filteredDonations.length === 0 && (
                  <div className="py-16 text-center bg-surface rounded-card border border-slate-200/80 shadow-card">
                    <p className="text-h3 font-semibold text-ink mb-1">No donations found</p>
                    <p className="text-caption text-ink-muted">Try a different search keyword.</p>
                  </div>
                )}

                {(activeSection === 'all' ? filteredDonations.slice(0, 3) : filteredDonations).map(don => (
                  <Card key={don.id} className="p-4 space-y-3 border border-slate-200/80 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            DONATION OFFER
                          </span>
                          <span className="text-[12px] text-ink-muted">
                            by <strong className="text-ink font-medium">{don.donor_name}</strong>
                          </span>
                        </div>
                        <h3 className="text-body font-semibold text-ink">
                          {fmtNumber(don.quantity_offered)} {don.unit} of {don.item_name}
                        </h3>
                        <p className="text-caption text-ink-muted mt-0.5">
                          Assigned to: <strong className="text-ink font-medium">{don.request_title}</strong>
                        </p>
                      </div>
                      <StatusBadge status={don.status as any} />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-caption text-ink-muted">
                      <span>Offered {relativeTime(don.created_at)}</span>
                      <div className="flex items-center gap-2">
                        {don.request_id && (
                          <Link to={`/requests/${don.request_id}`}>
                            <Button variant="secondary" size="sm">
                              View Request
                            </Button>
                          </Link>
                        )}
                        {don.request_id && (
                          <Link to={`/tracker/${don.request_id}`}>
                            <Button variant="primary" size="sm" className="gap-1">
                              <span>Track</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* ── 3. COLLECTION DRIVES SECTION ── */}
            {(activeSection === 'all' || activeSection === 'drives' || activeSection === 'nearby') && (
              <div className="space-y-3">
                {activeSection === 'all' && filteredDrives.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <span className="text-[12px] font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-brand-600" />
                      Community Collection Drives ({filteredDrives.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSectionChange('drives')}
                      className="text-[12px] text-brand-600 font-semibold hover:underline"
                    >
                      View all drives →
                    </button>
                  </div>
                )}

                {activeSection === 'drives' && filteredDrives.length === 0 && (
                  <div className="py-16 text-center bg-surface rounded-card border border-slate-200/80 shadow-card">
                    <p className="text-h3 font-semibold text-ink mb-1">No collection drives found</p>
                    <p className="text-caption text-ink-muted">No active community transport drives match this search.</p>
                  </div>
                )}

                {(activeSection === 'all' ? filteredDrives.slice(0, 3) : filteredDrives).map(drive => (
                  <Card key={drive.id} className="p-4 space-y-3 border border-slate-200/80 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                            COLLECTION DRIVE
                          </span>
                          <span className="text-[11px] font-medium text-ink-muted">
                            {drive.from_city} → {drive.destination_city || drive.to_city}
                          </span>
                        </div>
                        <h3 className="text-body font-semibold text-ink leading-snug">{drive.title}</h3>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-success-bg text-success uppercase tracking-wider">
                        {drive.status || 'Active'}
                      </span>
                    </div>

                    <div className="space-y-1 text-caption text-ink-muted">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span className="truncate">Hub: {drive.collection_location || drive.collection_address}</span>
                      </div>
                      {drive.departure_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span>Departure: {drive.departure_date}</span>
                        </div>
                      )}
                    </div>

                    {/* Target items badges */}
                    {drive.target_items && drive.target_items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {drive.target_items.slice(0, 3).map((it, idx) => (
                          <span key={idx} className="text-[11px] bg-slate-100 text-ink px-2 py-0.5 rounded border border-slate-200">
                            {it.name}: {it.pledged_quantity || 0}/{it.target_quantity} {it.unit}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <Link to={`/drives/${drive.id}`}>
                        <Button variant="secondary" size="sm" className="gap-1">
                          <span>View Drive Details</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Direct Offer Supplies Modal ── */}
      {selectedOfferRequest && (
        <MakeOfferSheet
          request={selectedOfferRequest}
          isOpen={Boolean(selectedOfferRequest)}
          onClose={() => setSelectedOfferRequest(null)}
        />
      )}
    </AppShell>
  )
}
