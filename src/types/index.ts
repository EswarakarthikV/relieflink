// ── Urgency ──────────────────────────────────────────────────────────────
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'

// ── Request status ────────────────────────────────────────────────────────
export type RequestStatus = 'open' | 'partially_fulfilled' | 'fulfilled' | 'closed'

// ── Offer / donation status ───────────────────────────────────────────────
export type OfferStatus = 'pending' | 'accepted' | 'dispatched' | 'delivered' | 'cancelled'

// ── Delivery method ───────────────────────────────────────────────────────
export type DeliveryMethod = 'self' | 'courier' | 'pickup'

// ── Notification type ─────────────────────────────────────────────────────
export type NotificationType = 'offer_received' | 'offer_accepted' | 'dispatched' | 'delivered' | 'new_request'

// ── User role ─────────────────────────────────────────────────────────────
export type UserRole = 'donor' | 'requester' | 'coordinator' | 'admin'

// ── Core domain models ────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatarInitials: string
  location?: string
  createdAt: string
  is_anonymous?: boolean
}

export interface SupplyItem {
  id: string
  name: string
  unit: string
  quantityRequested: number
  quantityCommitted: number
  quantityDelivered: number
  category: string
}

export interface Request {
  id: string
  refNumber: string      // e.g. "REQ-2024-089"
  title: string
  description?: string
  urgency: UrgencyLevel
  status: RequestStatus
  location: string
  address_line?: string
  city?: string
  coordinates?: { lat: number; lng: number }
  latitude?: number | null
  longitude?: number | null
  distanceKm?: number
  items: SupplyItem[]
  requesterId: string
  requesterName: string
  donorCount: number
  createdAt: string
  updatedAt: string
  expiresAt?: string
  disasterContext?: string   // e.g. "Chennai Flood Relief"
}

export interface RequestContact {
  request_id: string
  contact_name: string
  contact_phone: string
  contact_email?: string | null
}


export interface Offer {
  id: string
  requestId: string
  requestTitle: string
  donorId: string
  donorName: string
  itemName: string
  unit: string
  quantityOffered: number
  deliveryMethod: DeliveryMethod
  earliestDate: string
  message?: string
  status: OfferStatus
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  isRead: boolean
  relatedRequestId?: string
  relatedOfferId?: string
  createdAt: string
}

// ── API response wrappers ─────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  hasMore: boolean
}

// ── Filter/sort options ───────────────────────────────────────────────────

export interface RequestFilters {
  urgency?: UrgencyLevel[]
  status?: RequestStatus[]
  category?: string[]
  maxDistanceKm?: number
  search?: string
  sortBy?: 'urgency' | 'distance' | 'newest' | 'fulfillment'
}

// ── Collection Drives ─────────────────────────────────────────────────────

export type DriveStatus =
  | 'draft'
  | 'open'
  | 'collection_in_progress'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'delivered'
  | 'receipt_confirmed'
  | 'completed'
  | 'cancelled'

export type DriveContributionStatus =
  | 'pending'
  | 'accepted'
  | 'collection_arranged'
  | 'collected'
  | 'dispatched'
  | 'delivered'
  | 'receipt_confirmed'
  | 'declined'
  | 'cancelled'

export type DriveDeliveryMethod = 'pickup' | 'self_delivery' | 'courier'

export interface TargetSupplyItem {
  id?: string
  name: string
  unit: string
  target_quantity: number
  pledged_quantity?: number
  accepted_quantity?: number
  collected_quantity?: number
}

export interface CollectionDrive {
  id: string
  collector_id: string
  collector_name?: string
  title?: string
  description?: string
  organizer_name?: string
  organizer_contact?: string
  from_city: string
  to_city: string
  destination_city?: string
  destination_event: string
  destination_camp?: string
  destination_lat?: number | null
  destination_lng?: number | null
  collection_location?: string
  collection_address?: string
  collection_lat?: number | null
  collection_lng?: number | null
  departure_date: string
  start_time?: string | null
  deadline?: string | null
  vehicle_type: string
  capacity_kg: number
  needs: string[]
  target_items?: TargetSupplyItem[]
  accepted_items?: string[]
  unaccepted_items?: string[]
  instructions?: string
  pickup_enabled?: boolean
  pickup_radius_km?: number
  allow_pickup?: boolean
  allow_dropoff?: boolean
  allow_courier?: boolean
  require_dropoff?: boolean
  status: DriveStatus | string
  dispatched_at?: string | null
  dispatch_notes?: string | null
  delivered_at?: string | null
  delivered_by?: string | null
  receipt_confirmed_at?: string | null
  receipt_confirmed_by?: string | null
  recipient_name?: string | null
  recipient_contact?: string | null
  recipient_notes?: string | null
  created_at: string
  updated_at?: string
  linked_request_id?: string
  profiles?: {
    full_name?: string
    phone?: string
  } | null
}

export interface ContributionItem {
  item_name: string
  quantity: number
  unit: string
}

export interface DriveContribution {
  id: string
  drive_id: string
  donor_id?: string | null
  donor_name: string
  donor_contact?: string | null
  is_anonymous: boolean
  delivery_method: DriveDeliveryMethod
  donor_address?: string | null
  donor_lat?: number | null
  donor_lng?: number | null
  distance_km?: number | null
  pickup_scheduled_at?: string | null
  pickup_notes?: string | null
  status: DriveContributionStatus
  items: ContributionItem[]
  notes?: string | null
  created_at: string
  updated_at?: string
}

export interface PublicDriveContribution {
  id: string
  drive_id: string
  donor_display_name: string
  is_anonymous: boolean
  delivery_method: DriveDeliveryMethod
  status: DriveContributionStatus
  items: ContributionItem[]
  created_at: string
}

