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
