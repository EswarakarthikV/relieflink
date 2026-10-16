import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Notification, NotificationType } from '@/types'

export const INITIAL_MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n-001',
    type: 'offer_accepted',
    title: 'Offer Accepted',
    body: 'Your offer of 40 water bottles for "Drinking water for 200 families" has been accepted.',
    isRead: false,
    relatedRequestId: 'req-001',
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
  {
    id: 'n-002',
    type: 'new_request',
    title: 'Critical request near you',
    body: 'Emergency Tarpaulins needed in Shivajinagar (3.5 km away).',
    isRead: false,
    relatedRequestId: 'req-004',
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: 'n-003',
    type: 'dispatched',
    title: 'Shipment dispatched',
    body: 'Pediatric Antibiotics consignment is now in transit to Camp Area.',
    isRead: false,
    relatedRequestId: 'req-002',
    createdAt: new Date(Date.now() - 4 * 3_600_000).toISOString(),
  },
  {
    id: 'n-004',
    type: 'delivered',
    title: 'Delivery confirmed',
    body: 'Ration packets (80 boxes) confirmed delivered at Shivajinagar. Thank you!',
    isRead: true,
    relatedRequestId: 'req-003',
    createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
  },
  {
    id: 'n-005',
    type: 'new_request',
    title: 'High-urgency request posted',
    body: 'Field Hospital Alpha posted a new request for Saline Kits (80 packs needed).',
    isRead: true,
    relatedRequestId: 'req-002',
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
]

let mockMarkedRead = false

export function setMockNotificationsRead(read: boolean = true) {
  mockMarkedRead = read
  try {
    if (read) {
      localStorage.setItem('relieflink_notifications_read', 'true')
    } else {
      localStorage.removeItem('relieflink_notifications_read')
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function isMockMarkedRead(): boolean {
  if (mockMarkedRead) return true
  try {
    return localStorage.getItem('relieflink_notifications_read') === 'true'
  } catch {
    return false
  }
}

export async function fetchNotifications(): Promise<Notification[]> {
  if (isSupabaseConfigured) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (user?.id) {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          return data.map((n: any): Notification => ({
            id: String(n.id),
            type: (n.kind as NotificationType) || 'new_request',
            title: n.title,
            body: n.body || '',
            isRead: Boolean(n.read_at),
            createdAt: n.created_at,
            relatedRequestId: n.link ? n.link.split('/').pop() : undefined,
          }))
        }
      }
    } catch (err) {
      console.warn('Error fetching notifications from Supabase:', err)
    }
  }

  // Fallback to mock notifications
  const allRead = isMockMarkedRead()
  return INITIAL_MOCK_NOTIFICATIONS.map(n => ({
    ...n,
    isRead: allRead ? true : n.isRead,
  }))
}

export function useNotifications() {
  const query = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  })

  const notifications = query.data ?? INITIAL_MOCK_NOTIFICATIONS.map(n => ({
    ...n,
    isRead: isMockMarkedRead() ? true : n.isRead,
  }))

  const unreadCount = notifications.filter(n => !n.isRead).length

  return {
    ...query,
    notifications,
    unreadCount,
  }
}
