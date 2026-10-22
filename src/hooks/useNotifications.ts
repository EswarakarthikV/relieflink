import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Notification, NotificationType } from '@/types'

export const INITIAL_MOCK_NOTIFICATIONS: Notification[] = []

let mockMarkedRead = false
let dynamicMockNotifications: Notification[] = []

export function addNotification(
  notif: Omit<Notification, 'id' | 'createdAt' | 'isRead'> & { id?: string; createdAt?: string; isRead?: boolean }
) {
  const newNotif: Notification = {
    id: notif.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    isRead: notif.isRead ?? false,
    relatedRequestId: notif.relatedRequestId,
    relatedOfferId: notif.relatedOfferId,
    createdAt: notif.createdAt || new Date().toISOString(),
  }
  dynamicMockNotifications = [newNotif, ...dynamicMockNotifications]
}

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

        if (!error && data) {
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
  return dynamicMockNotifications.map(n => ({
    ...n,
    isRead: allRead ? true : n.isRead,
  }))
}

export function useNotifications() {
  const query = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const notifications = query.data ?? []

  const unreadCount = notifications.filter(n => !n.isRead).length

  return {
    ...query,
    notifications,
    unreadCount,
  }
}
