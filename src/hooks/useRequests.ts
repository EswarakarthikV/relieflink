import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import type { Request, Offer, RequestFilters, PaginatedResponse } from '@/types'

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
      { id: 'item-001', name: 'Drinking water', unit: 'bottles', quantityRequested: 200, quantityCommitted: 120, quantityDelivered: 0, category: 'Water' },
      { id: 'item-002', name: 'Hygiene kits',   unit: 'kits',    quantityRequested: 50,  quantityCommitted: 20,  quantityDelivered: 0, category: 'Hygiene' },
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

// ── API functions (stub — replace with Supabase) ──────────────────────────

async function fetchRequests(_filters?: RequestFilters): Promise<PaginatedResponse<Request>> {
  await new Promise(r => setTimeout(r, 600)) // simulate latency
  return { data: MOCK_REQUESTS, total: MOCK_REQUESTS.length, page: 1, perPage: 20, hasMore: false }
}

async function fetchRequest(id: string): Promise<Request> {
  await new Promise(r => setTimeout(r, 400))
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

// ── Mutation hooks ────────────────────────────────────────────────────────

export function useCreateOffer() {
  return useMutation({
    mutationFn: createOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}
