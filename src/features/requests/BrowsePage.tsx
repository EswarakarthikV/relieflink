import { useState, useEffect, useRef } from 'react'
import { Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { CardSkeleton } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { RequestCard } from './RequestCard'
import { useRequests } from '@/hooks/useRequests'
import { normalizeSearchQuery } from '@/lib/gemini'
import type { UrgencyLevel } from '@/types'
import { cn } from '@/utils/cn'

// ── Filter chips ─────────────────────────────────────────────────────────

type FilterChip = 'all' | UrgencyLevel | 'nearby' | 'open'

interface Chip { id: FilterChip; label: string }

const CHIPS: Chip[] = [
  { id: 'all',      label: 'All' },
  { id: 'critical', label: '🔴 Critical' },
  { id: 'high',     label: '🟠 High' },
  { id: 'nearby',   label: '📍 Near me' },
  { id: 'open',     label: 'Open' },
  { id: 'medium',   label: 'Medium' },
  { id: 'low',      label: 'Low' },
]

export function BrowsePage() {
  const [search, setSearch] = useState('')
  const [normalizedQuery, setNormalizedQuery] = useState('')
  const [isNormalizing, setIsNormalizing] = useState(false)
  const [translatedWord, setTranslatedWord] = useState<string | null>(null)
  const [activeChip, setActiveChip] = useState<FilterChip>('all')

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
        // Make sure user hasn't changed input since
        if (latestSearchRef.current.trim() === raw) {
          setNormalizedQuery(normalized)
          if (normalized.toLowerCase() !== raw.toLowerCase()) {
            setTranslatedWord(normalized)
          } else {
            setTranslatedWord(null)
          }
        }
      } catch (err) {
        console.warn('AI search normalization failed, falling back:', err)
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

  const { data, isLoading } = useRequests()
  const allRequests = data?.data ?? []

  const activeSearchTerm = (normalizedQuery || search).trim().toLowerCase()

  const filtered = allRequests.filter(req => {
    const q = activeSearchTerm
    const rawQ = search.trim().toLowerCase()

    // Match either the AI-normalized query OR the raw user text (e.g. city or title match)
    const matchSearch =
      !q ||
      req.title.toLowerCase().includes(q) ||
      req.title.toLowerCase().includes(rawQ) ||
      (req.city && (req.city.toLowerCase().includes(q) || req.city.toLowerCase().includes(rawQ))) ||
      req.location.toLowerCase().includes(q) ||
      req.location.toLowerCase().includes(rawQ) ||
      (req.items && req.items.some(it =>
        it.name.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(rawQ) ||
        (it.category && (it.category.toLowerCase().includes(q) || it.category.toLowerCase().includes(rawQ)))
      ))

    const matchChip =
      activeChip === 'all'    ? true :
      activeChip === 'nearby' ? (req.distanceKm ?? 999) <= 10 :
      activeChip === 'open'   ? req.status === 'open' :
      req.urgency === activeChip

    return matchSearch && matchChip
  })

  return (
    <AppShell>
      <TopBar title="Browse Requests" variant="navy" />

      {/* Sticky search + filter console */}
      <div className="sticky top-16 z-40 bg-surface shadow-sm pt-3 pb-2.5 px-4">
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
            placeholder="Search requests by item or location (e.g. kambili, water)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button aria-label="Filter" className="text-ink-muted hover:text-ink p-1 min-h-touch min-w-[44px] flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Translation Pill if AI translated the query */}
        {translatedWord && !isNormalizing && (
          <div className="mt-1.5 flex items-center gap-1.5 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-pill shadow-xs animate-in fade-in duration-200">
              <Sparkles className="w-3 h-3 text-brand-600" />
              <span>Searching for: <strong>{translatedWord}</strong></span>
            </span>
          </div>
        )}

        {/* Filter chips */}
        <nav aria-label="Filter requests" className="flex items-center gap-2 overflow-x-auto scroll-x pt-2.5 pb-0.5">
          {CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveChip(chip.id)}
              className={cn(
                'h-8 px-3.5 rounded-pill text-caption font-medium shrink-0',
                'flex items-center justify-center transition-all active:scale-95',
                activeChip === chip.id
                  ? 'bg-navy-900 text-white font-semibold'
                  : 'bg-surface-high text-on-surface-muted hover:text-ink border border-slate-200',
              )}
            >
              {chip.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Feed header */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-caption text-outline">
          Showing <span className="font-semibold text-ink">{filtered.length}</span> active requests
        </p>
        <div className="flex items-center gap-1 text-brand-600 text-caption font-medium">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Sorted by triage</span>
        </div>
      </div>

      {/* Request cards */}
      <section aria-label="Aid Requests Feed" className="flex flex-col gap-4 px-4 pt-2 pb-6">
        {isLoading
          ? [0, 1, 2, 3].map(i => <CardSkeleton key={i} />)
          : filtered.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-h3 font-semibold text-ink mb-2">No requests found</p>
                <p className="text-caption text-ink-muted">Try adjusting your filters or search term.</p>
              </div>
            )
            : filtered.map(req => <RequestCard key={req.id} request={req} />)
        }
      </section>
    </AppShell>
  )
}
