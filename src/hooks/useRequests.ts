import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import type { Request, Offer, RequestFilters, PaginatedResponse, SupplyItem, RequestContact } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// ── Mock data ─────────────────────────────────────────────────────────────
const MOCK_REQUESTS: Request[] = [
  {
    id: 'req-001',
    refNumber: 'REQ-2024-089',
    title: 'Drinking water for 200 families',
    urgency: 'critical',
    status: 'partially_fulfilled',
    location: 'Kothrud, Pune',
    distanceKm: 4.2,
    donorCount: 3,
    requesterId: 'usr-req-001',
    requesterName: 'Ngo Pune Relief',
    items: [
      { id: '71f59a32-b4c5-4143-b878-786ddd766680', name: 'Drinking water', unit: 'bottles', quantityRequested: 200, quantityCommitted: 120, quantityDelivered: 0, category: 'Water' },
      { id: '2978245a-cb1c-4c39-b016-db134a38ed55', name: 'Hygiene kits',   unit: 'kits',    quantityRequested: 50,  quantityCommitted: 20,  quantityDelivered: 0, category: 'Hygiene' },
    ],
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    disasterContext: 'Pune Flash Flood Relief',
  },
  {
    id: 'req-002',
    refNumber: 'REQ-2024-091',
    title: 'Pediatric Antibiotics & Saline',
    urgency: 'high',
    status: 'partially_fulfilled',
    location: 'Camp Area, Pune',
    distanceKm: 1.8,
    donorCount: 2,
    requesterId: 'usr-req-002',
    requesterName: 'Field Hospital Alpha',
    items: [
      { id: 'item-003', name: 'Pediatric antibiotics', unit: 'vials', quantityRequested: 150, quantityCommitted: 45, quantityDelivered: 0, category: 'Medical' },
      { id: 'item-004', name: 'Saline kits',           unit: 'packs', quantityRequested: 80,  quantityCommitted: 0,  quantityDelivered: 0, category: 'Medical' },
    ],
    createdAt: new Date(Date.now() - 4 * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    id: 'req-003',
    refNumber: 'REQ-2024-093',
    title: 'Emergency Ration Packets (7-Day)',
    urgency: 'medium',
    status: 'partially_fulfilled',
    location: 'Shivajinagar, Pune',
    distanceKm: 2.1,
    donorCount: 5,
    requesterId: 'usr-req-003',
    requesterName: 'Disaster Relief Cell',
    items: [
      { id: 'item-005', name: 'Dry ration boxes', unit: 'boxes', quantityRequested: 100, quantityCommitted: 95, quantityDelivered: 80, category: 'Food' },
      { id: 'item-006', name: 'Baby food packs',  unit: 'packs', quantityRequested: 30,  quantityCommitted: 28, quantityDelivered: 25, category: 'Food' },
    ],
    createdAt: new Date(Date.now() - 1 * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'req-004',
    refNumber: 'REQ-2024-095',
    title: 'Emergency Tarpaulins & Shelter Kits',
    urgency: 'critical',
    status: 'open',
    location: 'Shivajinagar, Pune',
    distanceKm: 3.5,
    donorCount: 1,
    requesterId: 'usr-req-003',
    requesterName: 'Disaster Relief Cell',
    items: [
      { id: 'item-007', name: 'Tarpaulin rolls', unit: 'rolls', quantityRequested: 150, quantityCommitted: 80, quantityDelivered: 0, category: 'Shelter' },
    ],
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
  },
]

export interface RequestItemStat {
  request_item_id: string
  request_id: string
  item_name: string
  unit: string
  category: string
  quantity_needed: number
  quantity_committed: number
  quantity_delivered: number
  quantity_remaining: number
}

// ── API functions (Supabase integration with mock fallback) ──────────────────

async function fetchRequests(_filters?: RequestFilters): Promise<PaginatedResponse<Request>> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*, request_items(*)')
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        const { data: allStats } = await supabase
          .from('request_item_stats')
          .select('*')

        const statsMap = new Map((allStats || []).map((s: any) => [s.request_item_id, s]))

        const dbRequests: Request[] = data.map((r: any, idx: number) => {
          const items: SupplyItem[] = (r.request_items || []).map((it: any) => {
            const stat = statsMap.get(it.id)
            return {
              id: it.id,
              name: it.item_name,
              category: it.category ? it.category.charAt(0).toUpperCase() + it.category.slice(1) : 'General',
              unit: it.unit,
              quantityRequested: stat ? Number(stat.quantity_needed) : (Number(it.quantity_needed) || 0),
              quantityCommitted: stat ? Number(stat.quantity_committed) : 0,
              quantityDelivered: stat ? Number(stat.quantity_delivered) : 0,
            }
          })

          return {
            id: r.id,
            refNumber: `REQ-2024-${String(idx + 1).padStart(3, '0')}`,
            title: r.title,
            description: r.description || undefined,
            urgency: r.urgency || 'medium',
            status: r.status || 'open',
            location: r.city || r.address_line || 'Pune',
            distanceKm: 2.5,
            donorCount: 0,
            requesterId: r.requester_id || 'usr-req',
            requesterName: 'Relief Coordinator',
            createdAt: r.created_at,
            updatedAt: r.updated_at || r.created_at,
            items,
          }
        })

        const all = [...dbRequests, ...MOCK_REQUESTS]
        return { data: all, total: all.length, page: 1, perPage: 20, hasMore: false }
      }
    } catch (err) {
      console.warn('Error fetching requests from Supabase, falling back to mock:', err)
    }
  }

  await new Promise(r => setTimeout(r, 400))
  return { data: MOCK_REQUESTS, total: MOCK_REQUESTS.length, page: 1, perPage: 20, hasMore: false }
}

async function fetchRequest(id: string): Promise<Request> {
  if (isSupabaseConfigured) {
    try {
      const { data: r, error } = await supabase
        .from('requests')
        .select('*, request_items(*)')
        .eq('id', id)
        .maybeSingle()

      if (!error && r) {
        const { data: stats } = await supabase
          .from('request_item_stats')
          .select('*')
          .eq('request_id', id)

        const statsMap = new Map((stats || []).map((s: any) => [s.request_item_id, s]))

        const items: SupplyItem[] = (r.request_items || []).map((it: any) => {
          const stat = statsMap.get(it.id)
          return {
            id: it.id,
            name: it.item_name,
            category: it.category ? it.category.charAt(0).toUpperCase() + it.category.slice(1) : 'General',
            unit: it.unit,
            quantityRequested: stat ? Number(stat.quantity_needed) : (Number(it.quantity_needed) || 0),
            quantityCommitted: stat ? Number(stat.quantity_committed) : 0,
            quantityDelivered: stat ? Number(stat.quantity_delivered) : 0,
          }
        })

        return {
          id: r.id,
          refNumber: `REQ-${r.id.slice(0, 8).toUpperCase()}`,
          title: r.title,
          description: r.description || undefined,
          urgency: r.urgency || 'medium',
          status: r.status || 'open',
          location: r.city || r.address_line || 'Pune',
          address_line: r.address_line || undefined,
          city: r.city || undefined,
          distanceKm: 2.5,
          donorCount: 0,
          requesterId: r.requester_id || 'usr-req',
          requesterName: 'Relief Coordinator',
          createdAt: r.created_at,
          updatedAt: r.updated_at || r.created_at,
          items,
        }
      }
    } catch (err) {
      console.warn('Error fetching single request from Supabase:', err)
    }
  }

  const req = MOCK_REQUESTS.find(r => r.id === id)
  if (!req) throw new Error(`Request ${id} not found`)
  return req
}

async function createOffer(offer: Omit<Offer, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Offer> {
  await new Promise(r => setTimeout(r, 700))
  return {
    ...offer,
    id: `offer-${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ── Query hooks ───────────────────────────────────────────────────────────

export function useRequests(filters?: RequestFilters) {
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: () => fetchRequests(filters),
  })
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => fetchRequest(id),
    enabled: Boolean(id),
  })
}

export function useRequestItemStats(requestId: string) {
  return useQuery<RequestItemStat[]>({
    queryKey: ['request_item_stats', requestId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !requestId) return []
      try {
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)
        let query = supabase.from('request_item_stats').select('*')
        if (isValidUUID) {
          query = query.eq('request_id', requestId)
        } else {
          const mockReq = MOCK_REQUESTS.find(r => r.id === requestId)
          const itemIds = mockReq?.items.map(i => i.id).filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || []
          if (itemIds.length > 0) {
            query = query.in('request_item_id', itemIds)
          } else {
            return []
          }
        }

        const { data, error } = await query

        if (error) {
          console.warn('Error fetching request_item_stats:', error)
          return []
        }

        return (data || []).map((row: any) => ({
          request_item_id: row.request_item_id,
          request_id: row.request_id,
          item_name: row.item_name,
          unit: row.unit,
          category: row.category,
          quantity_needed: Number(row.quantity_needed) || 0,
          quantity_committed: Number(row.quantity_committed) || 0,
          quantity_delivered: Number(row.quantity_delivered) || 0,
          quantity_remaining: Number(row.quantity_remaining) || 0,
        }))
      } catch (err) {
        console.warn('Error in useRequestItemStats queryFn:', err)
        return []
      }
    },
    enabled: Boolean(requestId),
  })
}


async function fetchMyRequests(userId: string): Promise<Request[]> {
  if (isSupabaseConfigured && userId) {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*, request_items(*)')
        .eq('requester_id', userId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        const { data: allStats } = await supabase
          .from('request_item_stats')
          .select('*')

        const statsMap = new Map((allStats || []).map((s: any) => [s.request_item_id, s]))

        const dbRequests: Request[] = data.map((r: any) => {
          const items: SupplyItem[] = (r.request_items || []).map((it: any) => {
            const stat = statsMap.get(it.id)
            return {
              id: it.id,
              name: it.item_name,
              category: it.category ? it.category.charAt(0).toUpperCase() + it.category.slice(1) : 'General',
              unit: it.unit,
              quantityRequested: stat ? Number(stat.quantity_needed) : (Number(it.quantity_needed) || 0),
              quantityCommitted: stat ? Number(stat.quantity_committed) : 0,
              quantityDelivered: stat ? Number(stat.quantity_delivered) : 0,
            }
          })

          return {
            id: r.id,
            refNumber: `REQ-${r.id.slice(0, 8).toUpperCase()}`,
            title: r.title,
            description: r.description || undefined,
            urgency: r.urgency || 'medium',
            status: r.status || 'open',
            location: r.city || r.address_line || 'Pune',
            distanceKm: 0,
            donorCount: 0,
            requesterId: r.requester_id || userId,
            requesterName: 'Me',
            createdAt: r.created_at,
            updatedAt: r.updated_at || r.created_at,
            items,
          }
        })

        return dbRequests
      }
    } catch (err) {
      console.warn('Error fetching my requests from Supabase:', err)
    }
  }

  return MOCK_REQUESTS.filter(r => r.requesterId === userId)
}

export function useMyRequests(userId?: string) {
  return useQuery<Request[]>({
    queryKey: ['my_requests', userId],
    queryFn: () => (userId ? fetchMyRequests(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
  })
}

// ── Mutation hooks ────────────────────────────────────────────────────────

export function useCreateOffer() {
  return useMutation({
    mutationFn: createOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['request'] })
      queryClient.invalidateQueries({ queryKey: ['request_item_stats'] })
      queryClient.invalidateQueries({ queryKey: ['request_contact'] })
    },
  })
}

export function useRequestContact(requestId: string) {
  return useQuery<RequestContact | null>({
    queryKey: ['request_contact', requestId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !requestId) return null
      try {
        const { data, error } = await supabase
          .from('request_contacts')
          .select('*')
          .eq('request_id', requestId)
          .maybeSingle()

        if (error || !data) return null
        return data as RequestContact
      } catch (err) {
        console.warn('Error fetching request contact:', err)
        return null
      }
    },
    enabled: Boolean(requestId),
  })
}

