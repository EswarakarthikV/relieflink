import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface TrackerOffer {
  id: string
  request_id: string
  request_item_id: string
  donor_id: string
  donor_name: string
  item_name: string
  unit: string
  quantity_offered: number
  quantity_dispatched: number
  quantity_delivered: number
  status: 'pending' | 'dispatched' | 'delivered' | 'cancelled' | 'rejected'
  message?: string
  dispatched_at?: string
  delivered_at?: string
  created_at: string
}

export const INITIAL_MOCK_OFFERS: TrackerOffer[] = [
  {
    id: 'off-001',
    request_id: 'req-001',
    request_item_id: '71f59a32-b4c5-4143-b878-786ddd766680',
    donor_id: 'usr-donor-001',
    donor_name: 'Priya Sharma',
    item_name: 'Drinking water',
    unit: 'bottles',
    quantity_offered: 80,
    quantity_dispatched: 0,
    quantity_delivered: 0,
    status: 'pending',
    message: 'Can supply 80 sealed 2L water bottles from Kothrud warehouse.',
    created_at: new Date(Date.now() - 40 * 60_000).toISOString(),
  },
  {
    id: 'off-002',
    request_id: 'req-001',
    request_item_id: '71f59a32-b4c5-4143-b878-786ddd766680',
    donor_id: 'usr-donor-002',
    donor_name: 'Apex Logistics',
    item_name: 'Drinking water',
    unit: 'bottles',
    quantity_offered: 40,
    quantity_dispatched: 40,
    quantity_delivered: 0,
    status: 'dispatched',
    message: 'Dispatched via truck MH-12-AB-1234.',
    created_at: new Date(Date.now() - 120 * 60_000).toISOString(),
    dispatched_at: new Date(Date.now() - 60 * 60_000).toISOString(),
  },
  {
    id: 'off-003',
    request_id: 'req-001',
    request_item_id: '2978245a-cb1c-4c39-b016-db134a38ed55',
    donor_id: 'usr-donor-003',
    donor_name: 'Rotary Club Pune',
    item_name: 'Hygiene kits',
    unit: 'kits',
    quantity_offered: 20,
    quantity_dispatched: 20,
    quantity_delivered: 20,
    status: 'delivered',
    message: 'Delivered to Kothrud volunteer reception desk.',
    created_at: new Date(Date.now() - 240 * 60_000).toISOString(),
    delivered_at: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
]

// In-memory mock store for demo/fallback interactions
let mockOffersStore: TrackerOffer[] = [...INITIAL_MOCK_OFFERS]

export function updateMockOfferStatus(
  offerId: string,
  status: TrackerOffer['status'],
  extras: Partial<TrackerOffer> = {},
) {
  mockOffersStore = mockOffersStore.map(o => {
    if (o.id === offerId) {
      return {
        ...o,
        status,
        ...extras,
      }
    }
    return o
  })
}

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

export async function fetchOffers(requestId: string): Promise<TrackerOffer[]> {
  if (isSupabaseConfigured && isValidUUID(requestId)) {
    try {
      // 1. Helper RPC that returns offers for a request ID regardless of who's viewing (bypasses RLS)
      const { data, error } = await supabase.rpc('get_request_offers', {
        p_request_id: requestId,
      })

      if (!error && data) {
        return data.map((row: any): TrackerOffer => ({
          id: row.id,
          request_id: requestId,
          request_item_id: row.request_item_id || '',
          donor_id: row.donor_id,
          donor_name: row.donor_name || 'Anonymous Donor',
          item_name: row.item_name || 'Supply item',
          unit: row.unit || 'units',
          quantity_offered: Number(row.quantity_offered) || 0,
          quantity_dispatched: Number(row.quantity_dispatched) || 0,
          quantity_delivered: Number(row.quantity_delivered) || 0,
          status: row.status as TrackerOffer['status'],
          message: row.message || undefined,
          dispatched_at: row.dispatched_at || undefined,
          delivered_at: row.delivered_at || undefined,
          created_at: row.created_at,
        }))
      }

      if (error) {
        console.warn('Error from get_request_offers RPC:', error)
      }
    } catch (err) {
      console.warn('Error fetching offers from Supabase RPC:', err)
    }
  }

  // Fallback to mock offers for mock IDs like 'req-001' or offline dev
  return mockOffersStore.filter(o => o.request_id === requestId || requestId === 'req-001')
}

export function useOffers(requestId: string) {
  return useQuery<TrackerOffer[]>({
    queryKey: ['request_offers', requestId],
    queryFn: () => fetchOffers(requestId),
    enabled: Boolean(requestId),
    refetchOnMount: 'always',
    staleTime: 0,
  })
}
