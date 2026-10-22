import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { Search, Heart, Package, ChevronRight } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { relativeTime, fmtNumber } from '@/utils/format'

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

// Fallback mock donations for offline / demo mode
const MOCK_DONATIONS: DonationItem[] = []

export function BrowseDonationsPage() {
  const [search, setSearch] = useState('')

  const { data: donations = [], isLoading } = useQuery<DonationItem[]>({
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
            return data.map((row: any) => ({
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

          if (error) {
            console.warn('Could not fetch donations from Supabase:', error.message)
          }
        } catch (err) {
          console.warn('Error fetching browse donations:', err)
        }
      }

      return []
    },
    refetchOnMount: 'always',
    staleTime: 0,
  })

  // Basic search filter by item name
  const filteredDonations = donations.filter(d => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return d.item_name.toLowerCase().includes(q)
  })

  return (
    <AppShell>
      <TopBar title="Browse Donations" variant="navy" />

      {/* Sticky search console */}
      <div className="sticky top-16 z-40 bg-surface shadow-sm pt-3 pb-3 px-4 max-w-2xl mx-auto w-full">
        <div className="h-11 bg-surface-low rounded-input px-3 flex items-center gap-2.5 focus-within:shadow-[0_0_0_2px_#2563EB] transition-shadow border border-slate-200">
          <Search className="w-5 h-5 text-ink-muted select-none shrink-0" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search donations by item name..."
            aria-label="Search donations by item name"
            className="flex-1 bg-transparent text-body text-ink placeholder:text-ink-muted outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-caption font-semibold text-brand-600 hover:text-brand-700 px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="pt-2 px-4 pb-24 max-w-2xl mx-auto flex flex-col gap-4">
        {/* Header subtitle info */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h2 font-semibold text-navy-900 tracking-tight flex items-center gap-2">
              <Heart className="w-6 h-6 text-brand-600 fill-brand-600/20" />
              Donor Contributions
            </h1>
            <p className="text-caption text-ink-muted mt-0.5">
              Live supplies and pledges offered by donors to active relief requests
            </p>
          </div>
        </div>

        {/* List of cards */}
        {isLoading ? (
          <PageSpinner label="Loading donations…" />
        ) : filteredDonations.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center gap-3 bg-surface/50 mt-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-h3 font-semibold text-navy-900">No donations found</h3>
            <p className="text-caption text-ink-muted max-w-sm">
              {search
                ? `No donations matching "${search}". Try searching for another item like "water" or "blankets".`
                : 'There are currently no active donor offers listed.'}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredDonations.map(donation => (
              <Card
                key={donation.id}
                className="p-4 bg-surface hover:shadow-card-hover transition-all flex flex-col gap-2.5 border border-slate-200"
              >
                {/* Top row: Status pill */}
                <div className="flex items-center justify-between">
                  <StatusBadge status={donation.status} />
                </div>

                {/* Title: Quantity Unit of Item */}
                <h3 className="text-h3 font-semibold text-navy-900 leading-snug">
                  {fmtNumber(donation.quantity_offered)} {donation.unit} of {donation.item_name}
                </h3>

                {/* Subtitle: "For: Request Title" linking to the request */}
                <div className="text-body text-ink-muted">
                  <span className="font-medium">For: </span>
                  <Link
                    to={donation.request_id ? `/requests/${donation.request_id}` : '#'}
                    className="text-brand-600 hover:text-brand-700 hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <span>{donation.request_title}</span>
                    <ChevronRight className="w-3.5 h-3.5 inline shrink-0" />
                  </Link>
                </div>

                {/* Footer: "Donated by [Donor Name] · [relative_time]" */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-caption text-ink-muted">
                  <span>
                    Donated by <strong className="font-semibold text-ink">{donation.donor_name}</strong> ·{' '}
                    {relativeTime(donation.created_at)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
