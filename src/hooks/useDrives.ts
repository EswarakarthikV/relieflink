import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { CollectionDrive } from '@/types'

export const INITIAL_MOCK_DRIVES: CollectionDrive[] = [
  {
    id: 'drive-001',
    collector_id: 'usr-col-001',
    collector_name: 'Erode Youth Forum',
    from_city: 'Erode',
    to_city: 'Chennai',
    destination_city: 'Chennai',
    destination_event: 'Chennai Flood Relief',
    departure_date: '2026-10-20',
    vehicle_type: 'Truck',
    capacity_kg: 500,
    needs: ['Water', 'Food', 'Hygiene'],
    status: 'open',
    created_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
    profiles: {
      full_name: 'Erode Youth Forum',
      phone: '+91 98401 23456',
    },
  },
  {
    id: 'drive-002',
    collector_id: 'usr-col-002',
    collector_name: 'Coimbatore Care Trust',
    from_city: 'Coimbatore',
    to_city: 'Wayanad',
    destination_city: 'Wayanad',
    destination_event: 'Wayanad Landslide Support',
    departure_date: '2026-10-22',
    vehicle_type: 'Van',
    capacity_kg: 350,
    needs: ['Medical', 'Shelter', 'Blankets'],
    status: 'open',
    created_at: new Date(Date.now() - 12 * 3600_000).toISOString(),
    profiles: {
      full_name: 'Coimbatore Care Trust',
      phone: '+91 98940 88776',
    },
  },
]

let mockDrivesStore: CollectionDrive[] = [...INITIAL_MOCK_DRIVES]

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

export async function fetchDrives(): Promise<CollectionDrive[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('collection_drives')
        .select('*, profiles:collector_id(id, full_name, phone)')
        .eq('status', 'open')
        .order('departure_date', { ascending: true })

      if (!error && data && data.length > 0) {
        return data as CollectionDrive[]
      }
      if (error) {
        console.warn('Error fetching collection drives from Supabase:', error)
      }
    } catch (err) {
      console.warn('Exception fetching collection drives:', err)
    }
  }

  return mockDrivesStore.filter(d => d.status === 'open')
}

export async function fetchDrive(id: string): Promise<CollectionDrive | null> {
  if (isSupabaseConfigured && isValidUUID(id)) {
    try {
      const { data, error } = await supabase
        .from('collection_drives')
        .select('*, profiles:collector_id(id, full_name, phone)')
        .eq('id', id)
        .maybeSingle()

      if (!error && data) {
        return data as CollectionDrive
      }
      if (error) {
        console.warn(`Error fetching drive ${id} from Supabase:`, error)
      }
    } catch (err) {
      console.warn(`Exception fetching drive ${id}:`, err)
    }
  }

  const match = mockDrivesStore.find(d => d.id === id)
  return match || null
}

export interface CreateDriveInput {
  fromCity: string
  toCity: string
  destinationEvent: string
  departureDate: string
  vehicleType: string
  capacityKg: number
  needs: string[]
}

export async function createCollectionDrive(input: CreateDriveInput): Promise<CollectionDrive> {
  if (isSupabaseConfigured) {
    let { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError) {
        throw new Error(`Authentication required: ${authError.message}`)
      }
      session = authData.session
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User session not found')
    }

    const payload = {
      collector_id: user.id,
      from_city: input.fromCity.trim(),
      to_city: input.toCity.trim(),
      destination_city: input.toCity.trim(),
      destination_event: input.destinationEvent.trim(),
      departure_date: input.departureDate,
      vehicle_type: input.vehicleType,
      capacity_kg: input.capacityKg,
      needs: input.needs,
      status: 'open',
    }

    const { data, error } = await supabase
      .from('collection_drives')
      .insert(payload)
      .select('*, profiles:collector_id(id, full_name, phone)')
      .single()

    if (error) {
      throw error
    }

    return data as CollectionDrive
  }

  // Fallback to local store for offline dev
  const mockId = `drive-${Date.now()}`
  const newDrive: CollectionDrive = {
    id: mockId,
    collector_id: 'usr-mock-collector',
    collector_name: 'Community Volunteer',
    from_city: input.fromCity.trim(),
    to_city: input.toCity.trim(),
    destination_city: input.toCity.trim(),
    destination_event: input.destinationEvent.trim(),
    departure_date: input.departureDate,
    vehicle_type: input.vehicleType,
    capacity_kg: input.capacityKg,
    needs: input.needs,
    status: 'open',
    created_at: new Date().toISOString(),
    profiles: {
      full_name: 'Community Volunteer',
    },
  }

  mockDrivesStore.unshift(newDrive)
  return newDrive
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useDrives() {
  return useQuery<CollectionDrive[]>({
    queryKey: ['collection_drives'],
    queryFn: fetchDrives,
    refetchOnMount: 'always',
  })
}

export function useDrive(id?: string) {
  return useQuery<CollectionDrive | null>({
    queryKey: ['collection_drive', id],
    queryFn: () => (id ? fetchDrive(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    refetchOnMount: 'always',
  })
}

export function useCreateDrive() {
  return useMutation({
    mutationFn: createCollectionDrive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection_drives'] })
    },
  })
}
