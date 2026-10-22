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
  status: 'pending' | 'accepted' | 'dispatched' | 'delivered' | 'cancelled' | 'rejected'
  message?: string
  delivery_method?: 'self' | 'courier' | 'pickup'
  pickup_date?: string
  pickup_time_window?: string
  pickup_address?: string
  pickup_contact?: string
  pickup_notes?: string
  pickup_status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'not_applicable'
  allow_calls?: boolean
  dispatched_at?: string
  delivered_at?: string
  created_at: string
}

export const INITIAL_MOCK_OFFERS: TrackerOffer[] = []

// In-memory mock store for demo/fallback interactions
let mockOffersStore: TrackerOffer[] = []

export function addMockOffer(offer: TrackerOffer) {
  mockOffersStore = [offer, ...mockOffersStore]
}

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
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData?.user?.id

      // 1. Helper RPC that returns offers for a request ID
      const { data, error } = await supabase.rpc('get_request_offers', {
        p_request_id: requestId,
      })

      if (!error && data) {
        return data.map((row: any): TrackerOffer => {
          const allowCalls = row.allow_calls !== false
          const isDonor = currentUserId && currentUserId === row.donor_id
          // Privacy protection: if calling is disabled and current user is not the donor, strip contact phone
          const safePickupContact = allowCalls || isDonor ? (row.pickup_contact || undefined) : undefined

          return {
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
            delivery_method: row.delivery_method || 'self',
            pickup_date: row.pickup_date || undefined,
            pickup_time_window: row.pickup_time_window || undefined,
            pickup_address: row.pickup_address || undefined,
            pickup_contact: safePickupContact,
            pickup_notes: row.pickup_notes || undefined,
            pickup_status: row.pickup_status || undefined,
            allow_calls: allowCalls,
            dispatched_at: row.dispatched_at || undefined,
            delivered_at: row.delivered_at || undefined,
            created_at: row.created_at,
          }
        })
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

export interface UserOfferItem extends TrackerOffer {
  request_title?: string
}

export async function fetchUserOffers(donorId?: string): Promise<UserOfferItem[]> {
  if (isSupabaseConfigured && donorId && isValidUUID(donorId)) {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          id,
          request_id,
          request_item_id,
          donor_id,
          quantity_offered,
          quantity_dispatched,
          quantity_delivered,
          status,
          message,
          delivery_method,
          pickup_date,
          pickup_time_window,
          pickup_address,
          pickup_contact,
          pickup_notes,
          pickup_status,
          dispatched_at,
          delivered_at,
          created_at,
          requests (
            id,
            title
          ),
          request_items (
            item_name,
            unit
          ),
          profiles:donor_id (
            full_name
          )
        `)
        .eq('donor_id', donorId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return data.map((row: any): UserOfferItem => ({
          id: row.id,
          request_id: row.request_id,
          request_item_id: row.request_item_id || '',
          donor_id: row.donor_id,
          donor_name: row.profiles?.full_name || 'You',
          item_name: row.request_items?.item_name || 'Supply item',
          unit: row.request_items?.unit || 'units',
          quantity_offered: Number(row.quantity_offered) || 0,
          quantity_dispatched: Number(row.quantity_dispatched) || 0,
          quantity_delivered: Number(row.quantity_delivered) || 0,
          status: row.status as TrackerOffer['status'],
          message: row.message || undefined,
          delivery_method: row.delivery_method || 'self',
          pickup_date: row.pickup_date || undefined,
          pickup_time_window: row.pickup_time_window || undefined,
          pickup_address: row.pickup_address || undefined,
          pickup_contact: row.pickup_contact || undefined,
          pickup_notes: row.pickup_notes || undefined,
          pickup_status: row.pickup_status || undefined,
          dispatched_at: row.dispatched_at || undefined,
          delivered_at: row.delivered_at || undefined,
          created_at: row.created_at,
          request_title: row.requests?.title || 'Relief Request',
        }))
      }
    } catch (err) {
      console.warn('Error fetching user offers from Supabase:', err)
    }
  }

  // Fallback to mock offers
  return mockOffersStore.map(o => ({
    ...o,
    request_title: o.request_id === 'req-001' ? 'Drinking water for 200 families' : 'Relief Request',
  }))
}

export function useUserOffers(donorId?: string) {
  return useQuery<UserOfferItem[]>({
    queryKey: ['user_offers', donorId],
    queryFn: () => fetchUserOffers(donorId),
    refetchOnMount: 'always',
    staleTime: 0,
  })
}
