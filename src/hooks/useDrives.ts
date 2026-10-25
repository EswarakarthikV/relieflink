import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type {
  CollectionDrive,
  DriveContribution,
  PublicDriveContribution,
  DriveContributionStatus,
  DriveDeliveryMethod,
  TargetSupplyItem,
  ContributionItem,
} from '@/types'

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

export const INITIAL_MOCK_DRIVES: CollectionDrive[] = []
export const INITIAL_MOCK_CONTRIBUTIONS: DriveContribution[] = []

let mockDrivesStore: CollectionDrive[] = []
let mockContributionsStore: DriveContribution[] = []

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

// ── Fetch Drives ─────────────────────────────────────────────────────────────

export async function fetchDrives(): Promise<CollectionDrive[]> {
  if (isSupabaseConfigured) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData?.user?.id

      const { data, error } = await supabase
        .from('collection_drives')
        .select('*, profiles:collector_id(id, full_name)')
        .order('departure_date', { ascending: true })

      if (!error && data) {
        return data
          .filter((d: any) => !d.title?.startsWith('Automated QA ') && !d.title?.startsWith('[TEST]'))
          .map((d: any) => {
          const drive = { ...d } as CollectionDrive
          if (drive.allow_calls === false && (!currentUserId || currentUserId !== drive.collector_id)) {
            drive.organizer_contact = undefined
          }
          if (drive.profiles && (drive.profiles as any).phone) {
            delete (drive.profiles as any).phone
          }
          return drive
        })
      }
      if (error) {
        console.warn('Error fetching collection drives from Supabase:', error)
      }
    } catch (err) {
      console.warn('Exception fetching collection drives:', err)
    }
  }

  return []
}

export async function fetchDrive(id: string): Promise<CollectionDrive | null> {
  if (isSupabaseConfigured && isValidUUID(id)) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData?.user?.id

      const { data, error } = await supabase
        .from('collection_drives')
        .select('*, profiles:collector_id(id, full_name)')
        .eq('id', id)
        .maybeSingle()

      if (!error && data) {
        const drive = { ...data } as CollectionDrive
        if (drive.allow_calls === false && (!currentUserId || currentUserId !== drive.collector_id)) {
          drive.organizer_contact = undefined
        }
        if (drive.profiles && (drive.profiles as any).phone) {
          delete (drive.profiles as any).phone
        }
        return drive
      }
      if (error) {
        console.warn(`Error fetching drive ${id} from Supabase:`, error)
      }
    } catch (err) {
      console.warn(`Exception fetching drive ${id}:`, err)
    }
  }

  return mockDrivesStore.find(d => d.id === id) || null
}

// ── Create Drive ─────────────────────────────────────────────────────────────

export interface CreateDriveInput {
  title?: string
  description?: string
  fromCity: string
  toCity: string
  destinationEvent: string
  destinationCamp?: string
  destinationLat?: number | null
  destinationLng?: number | null
  organizerName?: string
  organizerContact?: string
  collectionLocation?: string
  collectionAddress?: string
  collectionLat?: number | null
  collectionLng?: number | null
  departureDate: string
  deadline?: string
  vehicleType: string
  capacityKg: number
  needs: string[]
  targetItems?: TargetSupplyItem[]
  acceptedItems?: string[]
  unacceptedItems?: string[]
  instructions?: string
  pickupEnabled?: boolean
  pickupRadiusKm?: number
  allowPickup?: boolean
  allowDropoff?: boolean
  allowCourier?: boolean
  requireDropoff?: boolean
  allowCalls?: boolean
}

export async function createCollectionDrive(input: CreateDriveInput): Promise<CollectionDrive> {
  const fromCity = input.fromCity.trim()
  const toCity = input.toCity.trim()
  const destinationEvent = input.destinationEvent.trim()
  const title = input.title?.trim() || `${fromCity} to ${toCity} Relief Drive`
  const description = input.description?.trim() || ''

  const mockId = `drive-${Date.now()}`
  const newDrive: CollectionDrive = {
    id: mockId,
    collector_id: 'usr-mock-collector',
    collector_name: input.organizerName?.trim() || 'Community Organizer',
    organizer_name: input.organizerName?.trim() || 'Community Organizer',
    organizer_contact: input.organizerContact?.trim() || '',
    allow_calls: input.allowCalls !== false,
    title,
    description,
    from_city: fromCity,
    to_city: toCity,
    destination_city: toCity,
    destination_event: destinationEvent,
    destination_camp: input.destinationCamp?.trim() || '',
    destination_lat: input.destinationLat ?? null,
    destination_lng: input.destinationLng ?? null,
    collection_location: input.collectionLocation?.trim() || input.collectionAddress?.trim() || fromCity,
    collection_address: input.collectionAddress?.trim() || '',
    collection_lat: input.collectionLat ?? null,
    collection_lng: input.collectionLng ?? null,
    departure_date: input.departureDate,
    deadline: input.deadline || null,
    vehicle_type: input.vehicleType,
    capacity_kg: input.capacityKg,
    needs: input.needs,
    target_items: input.targetItems || [],
    accepted_items: input.acceptedItems || [],
    unaccepted_items: input.unacceptedItems || [],
    instructions: input.instructions?.trim() || '',
    pickup_enabled: Boolean(input.pickupEnabled),
    pickup_radius_km: input.pickupRadiusKm || 15,
    allow_pickup: Boolean(input.allowPickup ?? input.pickupEnabled),
    allow_dropoff: Boolean(input.allowDropoff ?? true),
    allow_courier: Boolean(input.allowCourier ?? false),
    require_dropoff: Boolean(input.requireDropoff ?? false),
    status: 'open',
    created_at: new Date().toISOString(),
    profiles: {
      full_name: input.organizerName?.trim() || 'Community Organizer',
      phone: input.organizerContact?.trim() || '',
    },
  }

  if (isSupabaseConfigured) {
    try {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data: authData } = await supabase.auth.signInAnonymously()
        session = authData?.session || null
      }

      const { data: { user } } = await supabase.auth.getUser()
      const collectorId = user?.id || 'usr-mock-collector'

      const payload = {
        collector_id: collectorId,
        title,
        description,
        organizer_name: input.organizerName?.trim() || 'Community Organizer',
        organizer_contact: input.organizerContact?.trim() || '',
        from_city: fromCity,
        to_city: toCity,
        destination_city: toCity,
        destination_event: destinationEvent,
        destination_camp: input.destinationCamp?.trim() || '',
        destination_lat: input.destinationLat ?? null,
        destination_lng: input.destinationLng ?? null,
        collection_location: input.collectionLocation?.trim() || input.collectionAddress?.trim() || fromCity,
        collection_address: input.collectionAddress?.trim() || '',
        collection_lat: input.collectionLat ?? null,
        collection_lng: input.collectionLng ?? null,
        departure_date: input.departureDate,
        deadline: input.deadline || null,
        vehicle_type: input.vehicleType,
        capacity_kg: input.capacityKg,
        needs: input.needs,
        target_items: input.targetItems || [],
        accepted_items: input.acceptedItems || [],
        unaccepted_items: input.unacceptedItems || [],
        instructions: input.instructions?.trim() || '',
        pickup_enabled: Boolean(input.pickupEnabled),
        pickup_radius_km: input.pickupRadiusKm || 15,
        allow_pickup: Boolean(input.allowPickup ?? input.pickupEnabled),
        allow_dropoff: Boolean(input.allowDropoff ?? true),
        allow_courier: Boolean(input.allowCourier ?? false),
        require_dropoff: Boolean(input.requireDropoff ?? false),
        allow_calls: input.allowCalls !== false,
        status: 'open',
      }

      let res = await supabase
        .from('collection_drives')
        .insert(payload)
        .select('*, profiles:collector_id(id, full_name)')
        .single()

      if (res.error && res.error.message?.includes('allow_calls')) {
        const payloadWithoutCalls = { ...payload }
        delete (payloadWithoutCalls as any).allow_calls
        res = await supabase
          .from('collection_drives')
          .insert(payloadWithoutCalls)
          .select('*, profiles:collector_id(id, full_name)')
          .single()
      }

      const { data, error } = res

      if (!error && data) {
        const savedDrive = { ...newDrive, ...data, id: data.id }
        mockDrivesStore.unshift(savedDrive)
        return savedDrive
      }

      if (error) {
        console.warn('Supabase collection_drives insert with extended columns failed (migration 007 may be pending):', error)
        // Fallback to inserting base schema columns from 001_schema.sql
        const basePayload = {
          collector_id: collectorId,
          from_city: fromCity,
          to_city: toCity,
          destination_city: toCity,
          destination_event: destinationEvent,
          departure_date: input.departureDate,
          vehicle_type: input.vehicleType,
          capacity_kg: input.capacityKg,
          needs: input.needs,
          status: 'open',
        }

        const { data: baseData, error: baseError } = await supabase
          .from('collection_drives')
          .insert(basePayload)
          .select('*')
          .single()

        if (!baseError && baseData) {
          const savedDrive = { ...newDrive, ...baseData, id: baseData.id }
          mockDrivesStore.unshift(savedDrive)
          return savedDrive
        }

        console.warn('Supabase base insert error, using local fallback:', baseError)
      }
    } catch (err) {
      console.warn('Supabase drive creation exception:', err)
    }
  }

  // Local fallback
  mockDrivesStore.unshift(newDrive)
  return newDrive
}

// ── Contributions ────────────────────────────────────────────────────────────

export interface CreateDriveContributionInput {
  driveId: string
  donorName: string
  donorContact?: string
  isAnonymous?: boolean
  deliveryMethod: DriveDeliveryMethod
  donorAddress?: string
  donorLat?: number | null
  donorLng?: number | null
  distanceKm?: number | null
  items: ContributionItem[]
  notes?: string
}

export async function createDriveContribution(
  input: CreateDriveContributionInput
): Promise<DriveContribution> {
  const drive = await fetchDrive(input.driveId)
  if (!drive) {
    throw new Error('Collection drive not found')
  }

  // Validate pickup radius if pickup method selected
  if (input.deliveryMethod === 'pickup') {
    if (!drive.pickup_enabled && !drive.allow_pickup) {
      throw new Error('Organizer pickup is not available for this drive. Please deliver your donation to the collection point.')
    }

    if (
      drive.collection_lat != null &&
      drive.collection_lng != null &&
      input.donorLat != null &&
      input.donorLng != null
    ) {
      const calculatedDistance = calculateDistanceKm(
        input.donorLat,
        input.donorLng,
        drive.collection_lat,
        drive.collection_lng
      )
      const maxRadius = drive.pickup_radius_km || 15
      if (calculatedDistance > maxRadius) {
        throw new Error(
          `Your location is ${calculatedDistance.toFixed(1)} km away, which exceeds the ${maxRadius} km pickup radius. No pickup available. Please deliver your donation to the collection point.`
        )
      }
      input.distanceKm = calculatedDistance
    }
  }

  if (isSupabaseConfigured && isValidUUID(input.driveId)) {
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      drive_id: input.driveId,
      donor_id: user?.id || null,
      donor_name: input.donorName.trim(),
      donor_contact: input.donorContact?.trim() || null,
      is_anonymous: Boolean(input.isAnonymous),
      delivery_method: input.deliveryMethod,
      donor_address: input.donorAddress?.trim() || null,
      donor_lat: input.donorLat ?? null,
      donor_lng: input.donorLng ?? null,
      distance_km: input.distanceKm ?? null,
      items: input.items,
      notes: input.notes?.trim() || null,
      status: 'pending',
    }

    const { data, error } = await supabase
      .from('collection_drive_contributions')
      .insert(payload)
      .select('*')
      .single()

    if (!error && data) {
      // Trigger background push notification to organizer if supported
      triggerDrivePushNotification({
        type: 'new_contribution',
        driveId: input.driveId,
        donorName: input.isAnonymous ? 'A donor' : input.donorName,
        itemCount: input.items.length,
      }).catch(err => console.warn('Push dispatch warning:', err))

      return data as DriveContribution
    }
    if (error) {
      console.warn('Supabase contribution insert failed, falling back to local store:', error)
    }
  }

  // Local fallback
  const newContrib: DriveContribution = {
    id: `contrib-${Date.now()}`,
    drive_id: input.driveId,
    donor_id: 'usr-local-donor',
    donor_name: input.donorName.trim(),
    donor_contact: input.donorContact?.trim() || null,
    is_anonymous: Boolean(input.isAnonymous),
    delivery_method: input.deliveryMethod,
    donor_address: input.donorAddress?.trim() || null,
    donor_lat: input.donorLat ?? null,
    donor_lng: input.donorLng ?? null,
    distance_km: input.distanceKm ?? null,
    items: input.items,
    notes: input.notes?.trim() || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  mockContributionsStore.unshift(newContrib)
  return newContrib
}

export async function fetchDriveContributions(
  driveId: string
): Promise<DriveContribution[]> {
  if (isSupabaseConfigured && isValidUUID(driveId)) {
    try {
      const { data, error } = await supabase
        .from('collection_drive_contributions')
        .select('*')
        .eq('drive_id', driveId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return data as DriveContribution[]
      }
    } catch (err) {
      console.warn('Error fetching contributions from Supabase:', err)
    }
  }

  return mockContributionsStore.filter(c => c.drive_id === driveId)
}

export async function fetchPublicDriveContributions(
  driveId: string
): Promise<PublicDriveContribution[]> {
  if (isSupabaseConfigured && isValidUUID(driveId)) {
    try {
      // Call secure RPC function get_public_drive_contributions that strips private addresses
      const { data, error } = await supabase.rpc('get_public_drive_contributions', {
        p_drive_id: driveId,
      })

      if (!error && data) {
        return data as PublicDriveContribution[]
      }
    } catch (err) {
      console.warn('Error calling get_public_drive_contributions RPC:', err)
    }
  }

  // Local fallback with privacy filtering
  return mockContributionsStore
    .filter(c => c.drive_id === driveId && c.status !== 'declined' && c.status !== 'cancelled')
    .map(c => ({
      id: c.id,
      drive_id: c.drive_id,
      donor_display_name: c.is_anonymous ? 'Anonymous Donor' : c.donor_name,
      is_anonymous: c.is_anonymous,
      delivery_method: c.delivery_method,
      status: c.status,
      items: c.items,
      created_at: c.created_at,
    }))
}

// ── Status Updates & Two-Step Delivery ───────────────────────────────────────

export async function updateDriveContributionStatus(
  contributionId: string,
  newStatus: DriveContributionStatus,
  pickupNotes?: string
): Promise<DriveContribution> {
  if (isSupabaseConfigured && isValidUUID(contributionId)) {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (pickupNotes) {
        updateData.pickup_notes = pickupNotes
      }
      if (newStatus === 'collection_arranged') {
        updateData.pickup_scheduled_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('collection_drive_contributions')
        .update(updateData)
        .eq('id', contributionId)
        .select('*')
        .single()

      if (!error && data) {
        return data as DriveContribution
      }
    } catch (err) {
      console.warn('Error updating contribution status in Supabase:', err)
    }
  }

  const item = mockContributionsStore.find(c => c.id === contributionId)
  if (!item) throw new Error('Contribution not found')
  item.status = newStatus
  if (pickupNotes) item.pickup_notes = pickupNotes
  item.updated_at = new Date().toISOString()
  return item
}

export async function dispatchDrive(
  driveId: string,
  dispatchNotes?: string
): Promise<void> {
  // Always update mock memory store first for immediate reactive sync
  const drive = mockDrivesStore.find(d => d.id === driveId)
  if (drive) {
    drive.status = 'dispatched'
    drive.dispatched_at = new Date().toISOString()
    drive.dispatch_notes = dispatchNotes || null
  }
  mockContributionsStore
    .filter(c => c.drive_id === driveId && c.status === 'collected')
    .forEach(c => {
      c.status = 'dispatched'
    })

  if (isSupabaseConfigured && isValidUUID(driveId)) {
    try {
      const { error } = await supabase.rpc('mark_drive_dispatched', {
        p_drive_id: driveId,
        p_dispatch_notes: dispatchNotes || null,
      })
      if (error) {
        // Fallback to basic status column from 001_schema.sql
        await supabase
          .from('collection_drives')
          .update({
            status: 'dispatched',
          })
          .eq('id', driveId)

        await supabase
          .from('collection_drive_contributions')
          .update({ status: 'dispatched' })
          .eq('drive_id', driveId)
          .eq('status', 'collected')
      }
    } catch (err) {
      console.warn('Error in dispatchDrive RPC, using fallback:', err)
    }
  }
}

export async function markDriveDelivered(
  driveId: string,
  notes?: string
): Promise<void> {
  const drive = mockDrivesStore.find(d => d.id === driveId)
  if (drive) {
    drive.status = 'delivered'
    drive.delivered_at = new Date().toISOString()
    drive.recipient_notes = notes || null
  }
  mockContributionsStore
    .filter(c => c.drive_id === driveId && c.status === 'dispatched')
    .forEach(c => {
      c.status = 'delivered'
    })

  if (isSupabaseConfigured && isValidUUID(driveId)) {
    try {
      const { error } = await supabase.rpc('mark_drive_delivered', {
        p_drive_id: driveId,
        p_delivery_notes: notes || null,
      })
      if (error) {
        await supabase
          .from('collection_drives')
          .update({
            status: 'delivered',
          })
          .eq('id', driveId)

        await supabase
          .from('collection_drive_contributions')
          .update({ status: 'delivered' })
          .eq('drive_id', driveId)
          .eq('status', 'dispatched')
      }
    } catch (err) {
      console.warn('Error in markDriveDelivered RPC, using fallback:', err)
    }
  }
}

export async function confirmDriveReceipt(
  driveId: string,
  recipientName: string,
  recipientContact?: string,
  notes?: string
): Promise<void> {
  if (!recipientName.trim()) {
    throw new Error('Recipient representative name is required to confirm receipt.')
  }

  const drive = mockDrivesStore.find(d => d.id === driveId)
  if (drive) {
    drive.status = 'receipt_confirmed'
    drive.receipt_confirmed_at = new Date().toISOString()
    drive.recipient_name = recipientName.trim()
    drive.recipient_contact = recipientContact?.trim() || null
    drive.recipient_notes = notes?.trim() || null
  }
  mockContributionsStore
    .filter(c => c.drive_id === driveId && c.status === 'delivered')
    .forEach(c => {
      c.status = 'receipt_confirmed'
    })

  if (isSupabaseConfigured && isValidUUID(driveId)) {
    try {
      const { error } = await supabase.rpc('confirm_drive_receipt', {
        p_drive_id: driveId,
        p_recipient_name: recipientName.trim(),
        p_recipient_contact: recipientContact?.trim() || null,
        p_recipient_notes: notes?.trim() || null,
      })
      if (error) {
        await supabase
          .from('collection_drives')
          .update({
            status: 'receipt_confirmed',
          })
          .eq('id', driveId)

        await supabase
          .from('collection_drive_contributions')
          .update({ status: 'receipt_confirmed' })
          .eq('drive_id', driveId)
          .eq('status', 'delivered')
      }
    } catch (err) {
      console.warn('Error in confirmDriveReceipt RPC, using fallback:', err)
    }
  }
}

export async function closeDrive(driveId: string): Promise<void> {
  if (isSupabaseConfigured && isValidUUID(driveId)) {
    await supabase
      .from('collection_drives')
      .update({ status: 'completed' })
      .eq('id', driveId)
    return
  }

  const drive = mockDrivesStore.find(d => d.id === driveId)
  if (drive) {
    drive.status = 'completed'
  }
}

// ── Background Notification Dispatch Helper ─────────────────────────────────

async function triggerDrivePushNotification(payload: {
  type: string
  driveId: string
  donorName?: string
  itemCount?: number
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        title: 'New Donation for Collection Drive',
        body: `${payload.donorName || 'A donor'} contributed ${payload.itemCount || 1} item(s) to your collection drive.`,
        url: `/drives/${payload.driveId}`,
        tag: `drive-${payload.driveId}-${Date.now()}`,
      }),
    })
  } catch (err) {
    // Non-fatal logging for client notifications
    console.debug('Drive notification trigger skipped or unsupported:', err)
  }
}

// ── TanStack Query Hooks ────────────────────────────────────────────────────

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

export function useDriveContributions(driveId?: string) {
  return useQuery<DriveContribution[]>({
    queryKey: ['drive_contributions', driveId],
    queryFn: () => (driveId ? fetchDriveContributions(driveId) : Promise.resolve([])),
    enabled: Boolean(driveId),
    refetchOnMount: 'always',
  })
}

export function usePublicDriveContributions(driveId?: string) {
  return useQuery<PublicDriveContribution[]>({
    queryKey: ['public_drive_contributions', driveId],
    queryFn: () => (driveId ? fetchPublicDriveContributions(driveId) : Promise.resolve([])),
    enabled: Boolean(driveId),
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

export function useCreateDriveContribution() {
  return useMutation({
    mutationFn: createDriveContribution,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drive_contributions', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['public_drive_contributions', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['collection_drive', variables.driveId] })
    },
  })
}

export function useUpdateDriveContributionStatus() {
  return useMutation({
    mutationFn: (params: {
      contributionId: string
      status: DriveContributionStatus
      pickupNotes?: string
      driveId: string
    }) => updateDriveContributionStatus(params.contributionId, params.status, params.pickupNotes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drive_contributions', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['public_drive_contributions', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['collection_drive', variables.driveId] })
    },
  })
}

export function useDispatchDrive() {
  return useMutation({
    mutationFn: ({ driveId, dispatchNotes }: { driveId: string; dispatchNotes?: string }) =>
      dispatchDrive(driveId, dispatchNotes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['collection_drive', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['drive_contributions', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['public_drive_contributions', variables.driveId] })
    },
  })
}

export function useMarkDriveDelivered() {
  return useMutation({
    mutationFn: ({ driveId, notes }: { driveId: string; notes?: string }) =>
      markDriveDelivered(driveId, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['collection_drive', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['drive_contributions', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['public_drive_contributions', variables.driveId] })
    },
  })
}

export function useConfirmDriveReceipt() {
  return useMutation({
    mutationFn: ({
      driveId,
      recipientName,
      recipientContact,
      notes,
    }: {
      driveId: string
      recipientName: string
      recipientContact?: string
      notes?: string
    }) => confirmDriveReceipt(driveId, recipientName, recipientContact, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['collection_drive', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['drive_contributions', variables.driveId] })
      queryClient.invalidateQueries({ queryKey: ['public_drive_contributions', variables.driveId] })
    },
  })
}
