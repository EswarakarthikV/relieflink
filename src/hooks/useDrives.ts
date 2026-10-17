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

export const INITIAL_MOCK_DRIVES: CollectionDrive[] = [
  {
    id: 'drive-001',
    collector_id: 'usr-col-001',
    collector_name: 'Erode Youth Forum',
    organizer_name: 'Erode Youth Forum',
    organizer_contact: '+91 98401 23456',
    title: 'Erode to Chennai Flood Relief Drive',
    description: 'Collecting blankets, dry food, and clean water bottles to deliver directly to Royapettah Relief Camp in Chennai.',
    from_city: 'Erode',
    to_city: 'Chennai',
    destination_city: 'Chennai',
    destination_event: 'Chennai Flood Relief',
    destination_camp: 'Royapettah Relief Camp',
    destination_lat: 13.0569,
    destination_lng: 80.2575,
    collection_location: 'Erode Bus Stand Hub',
    collection_address: 'Central Community Hall, Bus Stand Road, Erode',
    collection_lat: 11.3410,
    collection_lng: 77.7172,
    departure_date: '2026-10-20',
    deadline: '2026-10-19T20:00:00.000Z',
    vehicle_type: 'Truck',
    capacity_kg: 500,
    needs: ['Water', 'Food', 'Blankets', 'Hygiene'],
    target_items: [
      { name: 'Water (Bottles)', unit: 'bottles', target_quantity: 200, pledged_quantity: 60, accepted_quantity: 40, collected_quantity: 30 },
      { name: 'Blankets', unit: 'pieces', target_quantity: 100, pledged_quantity: 35, accepted_quantity: 25, collected_quantity: 15 },
      { name: 'Biscuits / Dry Food', unit: 'packets', target_quantity: 150, pledged_quantity: 50, accepted_quantity: 30, collected_quantity: 20 },
      { name: 'Hygiene Kits', unit: 'kits', target_quantity: 50, pledged_quantity: 10, accepted_quantity: 10, collected_quantity: 5 },
    ],
    accepted_items: ['Packed drinking water', 'New blankets', 'Sealed biscuits', 'Sanitary napkins', 'Soap & toothbrushes'],
    unaccepted_items: ['Cooked or perishable food', 'Used or torn clothes', 'Expired medicines', 'Liquids in open containers'],
    instructions: 'Please pack in sturdy cardboard boxes or waterproof bags. Label each box with contents.',
    pickup_enabled: true,
    pickup_radius_km: 15,
    allow_pickup: true,
    allow_dropoff: true,
    allow_courier: true,
    require_dropoff: false,
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
    organizer_name: 'Coimbatore Care Trust',
    organizer_contact: '+91 98940 88776',
    title: 'Coimbatore Wayanad Emergency Supplies',
    description: 'Dispatching essential medical kits, tarpaulins and shelter materials to Meppadi Community Health Centre.',
    from_city: 'Coimbatore',
    to_city: 'Wayanad',
    destination_city: 'Wayanad',
    destination_event: 'Wayanad Landslide Support',
    destination_camp: 'Meppadi Relief Base',
    destination_lat: 11.5516,
    destination_lng: 76.1264,
    collection_location: 'Gandhipuram Relief Centre',
    collection_address: 'VOC Park Gate 2, Gandhipuram, Coimbatore',
    collection_lat: 11.0168,
    collection_lng: 76.9558,
    departure_date: '2026-10-22',
    deadline: '2026-10-21T18:00:00.000Z',
    vehicle_type: 'Van',
    capacity_kg: 350,
    needs: ['Medical', 'Shelter', 'Blankets'],
    target_items: [
      { name: 'First Aid Kits', unit: 'kits', target_quantity: 80, pledged_quantity: 20, accepted_quantity: 15, collected_quantity: 10 },
      { name: 'Tarpaulin Sheets', unit: 'sheets', target_quantity: 60, pledged_quantity: 15, accepted_quantity: 10, collected_quantity: 5 },
      { name: 'Warm Blankets', unit: 'pieces', target_quantity: 120, pledged_quantity: 40, accepted_quantity: 30, collected_quantity: 25 },
    ],
    accepted_items: ['New tarpaulins', 'Antiseptic & bandages', 'Torches & batteries', 'Thermal wear'],
    unaccepted_items: ['Prescription drugs without prescription', 'Glass bottles', 'Cooked meals'],
    instructions: 'Drop off between 9 AM and 7 PM at Gate 2. Pickups available for orders > 20 kg within 10 km.',
    pickup_enabled: true,
    pickup_radius_km: 10,
    allow_pickup: true,
    allow_dropoff: true,
    allow_courier: false,
    require_dropoff: false,
    status: 'open',
    created_at: new Date(Date.now() - 12 * 3600_000).toISOString(),
    profiles: {
      full_name: 'Coimbatore Care Trust',
      phone: '+91 98940 88776',
    },
  },
]

export const INITIAL_MOCK_CONTRIBUTIONS: DriveContribution[] = [
  {
    id: 'contrib-001',
    drive_id: 'drive-001',
    donor_id: 'usr-donor-1',
    donor_name: 'Anand Kumar',
    donor_contact: '+91 98765 43210',
    is_anonymous: false,
    delivery_method: 'self_delivery',
    donor_address: '14 Perundurai Road, Erode',
    donor_lat: 11.332,
    donor_lng: 77.712,
    distance_km: 1.2,
    status: 'collected',
    items: [
      { item_name: 'Blankets', quantity: 10, unit: 'pieces' },
      { item_name: 'Water (Bottles)', quantity: 20, unit: 'bottles' },
    ],
    notes: 'Dropped off at the counter yesterday.',
    created_at: new Date(Date.now() - 20 * 3600_000).toISOString(),
  },
  {
    id: 'contrib-002',
    drive_id: 'drive-001',
    donor_id: 'usr-donor-2',
    donor_name: 'Kavitha R',
    donor_contact: '+91 98765 11223',
    is_anonymous: false,
    delivery_method: 'pickup',
    donor_address: '22 Solar Nagar, Erode',
    donor_lat: 11.315,
    donor_lng: 77.732,
    distance_km: 3.4,
    pickup_scheduled_at: '2026-10-18T14:00:00.000Z',
    status: 'accepted',
    items: [
      { item_name: 'Biscuits / Dry Food', quantity: 25, unit: 'packets' },
    ],
    notes: 'Please call before arriving.',
    created_at: new Date(Date.now() - 10 * 3600_000).toISOString(),
  },
  {
    id: 'contrib-003',
    drive_id: 'drive-001',
    donor_id: 'usr-donor-3',
    donor_name: 'Secret Helper',
    donor_contact: '+91 94432 99887',
    is_anonymous: true,
    delivery_method: 'self_delivery',
    status: 'accepted',
    items: [
      { item_name: 'Water (Bottles)', quantity: 40, unit: 'bottles' },
    ],
    notes: 'Will bring by Saturday noon.',
    created_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
  },
]

let mockDrivesStore: CollectionDrive[] = [...INITIAL_MOCK_DRIVES]
let mockContributionsStore: DriveContribution[] = [...INITIAL_MOCK_CONTRIBUTIONS]

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

// ── Fetch Drives ─────────────────────────────────────────────────────────────

export async function fetchDrives(): Promise<CollectionDrive[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('collection_drives')
        .select('*, profiles:collector_id(id, full_name, phone)')
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

  return mockDrivesStore
}

export async function fetchDrive(id: string): Promise<CollectionDrive | null> {
  const localMatch = mockDrivesStore.find(d => d.id === id)

  if (isSupabaseConfigured && isValidUUID(id)) {
    try {
      const { data, error } = await supabase
        .from('collection_drives')
        .select('*, profiles:collector_id(id, full_name, phone)')
        .eq('id', id)
        .maybeSingle()

      if (!error && data) {
        return { ...(localMatch || {}), ...data } as CollectionDrive
      }
      if (error) {
        console.warn(`Error fetching drive ${id} from Supabase:`, error)
      }
    } catch (err) {
      console.warn(`Exception fetching drive ${id}:`, err)
    }
  }

  return localMatch || null
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
        status: 'open',
      }

      const { data, error } = await supabase
        .from('collection_drives')
        .insert(payload)
        .select('*, profiles:collector_id(id, full_name, phone)')
        .single()

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
