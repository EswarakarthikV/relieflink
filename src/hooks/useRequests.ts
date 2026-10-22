import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import type { Request, Offer, RequestFilters, PaginatedResponse, SupplyItem, RequestContact } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// ── Mock data ─────────────────────────────────────────────────────────────
const MOCK_REQUESTS: Request[] = []

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

      if (!error && data) {
        if (data.length === 0) {
          return { data: [], total: 0, page: 1, perPage: 20, hasMore: false }
        }

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
            location: r.city || r.address_line || 'Location not specified',
            address_line: r.address_line || undefined,
            city: r.city || undefined,
            latitude: r.latitude != null ? Number(r.latitude) : null,
            longitude: r.longitude != null ? Number(r.longitude) : null,
            coordinates: r.latitude != null && r.longitude != null
              ? { lat: Number(r.latitude), lng: Number(r.longitude) }
              : undefined,
            distanceKm: 2.5,
            donorCount: 0,
            requesterId: r.requester_id || 'usr-req',
            requesterName: 'Relief Coordinator',
            createdAt: r.created_at,
            updatedAt: r.updated_at || r.created_at,
            items,
          }
        })

        return { data: dbRequests, total: dbRequests.length, page: 1, perPage: 20, hasMore: false }
      }
    } catch (err) {
      console.warn('Error fetching requests from Supabase:', err)
    }
  }

  return { data: [], total: 0, page: 1, perPage: 20, hasMore: false }
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
          location: r.city || r.address_line || 'Location not specified',
          address_line: r.address_line || undefined,
          city: r.city || undefined,
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          coordinates: r.latitude != null && r.longitude != null
            ? { lat: Number(r.latitude), lng: Number(r.longitude) }
            : undefined,
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
    refetchOnMount: 'always',
    staleTime: 0,
  })
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => fetchRequest(id),
    enabled: Boolean(id),
    refetchOnMount: 'always',
    staleTime: 0,
  })
}

export function useRequestItemStats(requestId: string) {
  return useQuery<RequestItemStat[]>({
    queryKey: ['request_item_stats', requestId],
    queryFn: async () => {
      if (!requestId) return []
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)
      if (!isValidUUID) {
        const mockReq = MOCK_REQUESTS.find(r => r.id === requestId)
        if (!mockReq) return []
        return mockReq.items.map(it => ({
          request_item_id: it.id,
          request_id: mockReq.id,
          item_name: it.name,
          unit: it.unit,
          category: it.category.toLowerCase(),
          quantity_needed: it.quantityRequested,
          quantity_committed: it.quantityCommitted,
          quantity_delivered: it.quantityDelivered,
          quantity_remaining: Math.max(0, it.quantityRequested - it.quantityCommitted),
        }))
      }

      if (!isSupabaseConfigured) return []
      try {
        const query = supabase
          .from('request_item_stats')
          .select('*')
          .eq('request_id', requestId)

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
        if (data.length === 0) return []

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
            location: r.city || r.address_line || 'Location not specified',
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

  return []
}

export function useMyRequests(userId?: string) {
  return useQuery<Request[]>({
    queryKey: ['my_requests', userId],
    queryFn: () => (userId ? fetchMyRequests(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    refetchOnMount: 'always',
    staleTime: 0,
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

export function useRequestContact(
  requestId: string,
  options?: { allowCalls?: boolean; requesterId?: string }
) {
  return useQuery<RequestContact | null>({
    queryKey: ['request_contact', requestId, options?.allowCalls, options?.requesterId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !requestId) return null
      try {
        const { data: authData } = await supabase.auth.getUser()
        const currentUserId = authData?.user?.id

        const { data, error } = await supabase
          .from('request_contacts')
          .select('*')
          .eq('request_id', requestId)
          .maybeSingle()

        if (error || !data) return null
        const contact = data as RequestContact

        // Security check: if calling is disabled and current user is not coordinator, sanitize phone
        if (options?.allowCalls === false && (!currentUserId || currentUserId !== options.requesterId)) {
          return {
            ...contact,
            contact_phone: '',
          }
        }
        return contact
      } catch (err) {
        console.warn('Error fetching request contact:', err)
        return null
      }
    },
    enabled: Boolean(requestId),
  })
}

