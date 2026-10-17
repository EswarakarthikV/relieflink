import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  isIOS,
  isPWAStandalone,
  registerServiceWorker,
  urlBase64ToUint8Array,
  savePushSubscription,
  removePushSubscription,
  triggerLocalTestNotification,
  VAPID_PUBLIC_KEY,
} from '@/lib/pushNotifications'
import { useAuth } from './useAuth'

export type PushPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported'

const PUSH_ENABLED_STORAGE_KEY = 'relieflink_push_enabled'

export interface UsePushNotificationsResult {
  permissionState: PushPermissionStatus
  isSubscribed: boolean
  isLoading: boolean
  isIOSBrowserWithoutPWA: boolean
  error: string | null
  subscription: PushSubscription | null
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  sendTestNotification: (title?: string, body?: string) => Promise<boolean>
  refreshStatus: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth()
  const [permissionState, setPermissionState] = useState<PushPermissionStatus>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  const isIOSBrowserWithoutPWA = isIOS() && !isPWAStandalone()

  const refreshStatus = useCallback(async () => {
    if (!isPushSupported()) {
      setPermissionState('unsupported')
      setIsLoading(false)
      return
    }

    try {
      const currentPerm = Notification.permission as PushPermissionStatus
      setPermissionState(currentPerm)

      // Register or verify service worker
      const registration = await registerServiceWorker()
      if (!registration) {
        setIsLoading(false)
        return
      }

      // Check PushManager for an existing active subscription
      const existingSub = await registration.pushManager?.getSubscription().catch(() => null)
      if (existingSub) {
        setSubscription(existingSub)
        setIsSubscribed(true)
        if (user?.id) {
          savePushSubscription(existingSub, user.id)
        }
      } else if (currentPerm === 'granted') {
        const locallyEnabled = localStorage.getItem(PUSH_ENABLED_STORAGE_KEY) === 'true'
        if (locallyEnabled) {
          setIsSubscribed(true)
        } else {
          setIsSubscribed(false)
        }
      } else {
        setSubscription(null)
        setIsSubscribed(false)
      }
    } catch (err: unknown) {
      console.warn('[ReliefLink Push] Status check warning:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const subscribe = async (): Promise<boolean> => {
    setError(null)
    setIsLoading(true)

    try {
      if (!isPushSupported()) {
        setError('Push notifications are not supported in this browser.')
        setPermissionState('unsupported')
        setIsLoading(false)
        return false
      }

      if (isIOSBrowserWithoutPWA) {
        setError('On iOS, tap the Share button and select "Add to Home Screen" first.')
        setIsLoading(false)
        return false
      }

      // 1. Request native notification permission on user gesture
      const permission = await Notification.requestPermission()
      setPermissionState(permission as PushPermissionStatus)

      if (permission !== 'granted') {
        if (permission === 'denied') {
          setError('Notification permission was blocked. Please enable it in your browser settings.')
        }
        setIsLoading(false)
        return false
      }

      // 2. Ensure Service Worker is registered and ready
      let registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        registration = (await registerServiceWorker()) || undefined
      }

      const swReady = await navigator.serviceWorker.ready
      if (!swReady) {
        throw new Error('Service worker is not ready.')
      }

      // 3. Subscribe to push manager with VAPID key (with timeout safety)
      let newSub: PushSubscription | null = null
      if (swReady.pushManager) {
        try {
          const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          const subscribePromise = swReady.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey as unknown as BufferSource,
          })
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Push endpoint registration timed out')), 6000),
          )
          newSub = await Promise.race([subscribePromise, timeoutPromise])
        } catch (subErr: unknown) {
          console.warn('[ReliefLink Push] Remote PushManager note:', subErr)
        }
      }

      // 4. Save to database / local mirror if remote subscription obtained
      if (newSub) {
        await savePushSubscription(newSub, user?.id)
        setSubscription(newSub)
      }

      try {
        localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, 'true')
      } catch {
        // ignore
      }

      setIsSubscribed(true)
      setIsLoading(false)
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ReliefLink Push] Subscription error:', msg)
      setError(msg)
      setIsLoading(false)
      return false
    }
  }

  const unsubscribe = async (): Promise<boolean> => {
    setError(null)
    setIsLoading(true)

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const currentSub = await registration?.pushManager?.getSubscription().catch(() => null)

        if (currentSub) {
          const endpoint = currentSub.endpoint
          await currentSub.unsubscribe().catch(() => {})
          await removePushSubscription(endpoint)
        }
      }

      try {
        localStorage.removeItem(PUSH_ENABLED_STORAGE_KEY)
      } catch {
        // ignore
      }

      setSubscription(null)
      setIsSubscribed(false)
      setIsLoading(false)
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ReliefLink Push] Unsubscribe error:', msg)
      setError(msg)
      setIsLoading(false)
      return false
    }
  }

  const sendTestNotification = async (
    title?: string,
    body?: string,
  ): Promise<boolean> => {
    try {
      return await triggerLocalTestNotification(title, body)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ReliefLink Push] Test notification error:', msg)
      setError(msg)
      return false
    }
  }

  return {
    permissionState,
    isSubscribed,
    isLoading,
    isIOSBrowserWithoutPWA,
    error,
    subscription,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refreshStatus,
  }
}
