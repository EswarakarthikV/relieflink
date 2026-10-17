import { supabase, isSupabaseConfigured } from './supabase'

export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BLcWKyn6k68qeTE8-6uQ2XeMy6lNijXZVkC_9H5bkxJSL_OrUEZ4tHA1BcpXZmQsZ86iwyBdRG9M_K69UwtkjMw'

const LOCAL_STORAGE_KEY = 'relieflink_push_subscription'

/**
 * Converts a base64url string into a Uint8Array buffer for applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Checks if the current browser and platform support the Web Push API
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Detects iOS device
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Checks if running as an installed standalone PWA
 */
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * Registers the root service worker (/sw.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
    return registration
  } catch (err) {
    console.error('[ReliefLink Push] Service Worker registration failed:', err)
    return null
  }
}

/**
 * Saves a push subscription to Supabase and falls back safely to localStorage
 */
export async function savePushSubscription(
  subscription: PushSubscription,
  userId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const json = subscription.toJSON()
    const endpoint = subscription.endpoint
    const p256dh = json.keys?.p256dh || ''
    const auth = json.keys?.auth || ''
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

    const subRecord = {
      endpoint,
      p256dh,
      auth,
      user_id: userId || null,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    }

    // Always mirror to localStorage for resilience
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(subRecord))
    } catch {
      // ignore storage quota issues
    }

    if (isSupabaseConfigured) {
      // Upsert into push_subscriptions table
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          endpoint,
          p256dh,
          auth,
          user_id: userId || null,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      )

      if (error) {
        // Table might not yet exist or RLS issue; gracefully note and retain local state
        console.warn('[ReliefLink Push] Supabase push_subscriptions save note:', error.message)
      }
    }

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ReliefLink Push] Failed to save subscription:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Removes a push subscription from Supabase and localStorage
 */
export async function removePushSubscription(
  endpoint: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
    } catch {
      // ignore
    }

    if (isSupabaseConfigured) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

/**
 * Sends a local test notification directly via the Service Worker
 */
export async function triggerLocalTestNotification(
  title: string = 'ReliefLink Emergency Alert',
  body: string = 'Push notifications are active. You will receive real-time supply alerts and dispatch updates.',
  url: string = '/alerts',
): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false

  try {
    const registration = await navigator.serviceWorker.ready
    if (!registration) return false

    // If ServiceWorkerRegistration.showNotification is available, use it directly
    if ('showNotification' in registration) {
      await (registration as ServiceWorkerRegistration).showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/favicon.png',
        tag: 'relieflink-test-alert',
        renotify: true,
        data: { url },
      } as NotificationOptions & { renotify?: boolean })
      return true
    }

    const activeWorker = (registration as ServiceWorkerRegistration).active
    if (activeWorker) {
      activeWorker.postMessage({
        type: 'SHOW_TEST_NOTIFICATION',
        payload: { title, body, url },
      })
      return true
    }

    return false
  } catch (err) {
    console.error('[ReliefLink Push] Failed to show test notification:', err)
    return false
  }
}

export interface RemotePushParams {
  event?: 'critical_request' | 'offer_created' | 'offer_accepted' | 'offer_dispatched' | 'offer_delivered' | 'offer_rejected' | 'offer_cancelled' | 'test' | 'broadcast' | 'direct'
  recipientUserId?: string | null
  title: string
  body: string
  url?: string
  tag?: string
  idempotencyKey?: string
}

/**
 * Dispatches a remote Web Push notification via the server-side /api/notify endpoint.
 * This runs asynchronously and isolated: any delivery issue or offline state will NOT disrupt client transactions.
 */
export async function triggerRemotePush(params: RemotePushParams): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      } catch {
        // ignore session retrieval issues
      }
    }

    const res = await fetch('/api/notify', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      console.warn('[ReliefLink Push] Remote push dispatch non-ok status:', res.status, errJson)
      return { success: false, error: errJson.error || `HTTP ${res.status}` }
    }

    const data = await res.json().catch(() => ({}))
    return { success: true, duplicate: data.duplicate }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[ReliefLink Push] Remote push dispatch network exception (non-fatal):', msg)
    return { success: false, error: msg }
  }
}

