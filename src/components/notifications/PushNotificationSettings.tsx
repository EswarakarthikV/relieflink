import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Toast } from '@/components/ui/Toast'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react'

interface PushNotificationSettingsProps {
  compact?: boolean
}

export function PushNotificationSettings({ compact = false }: PushNotificationSettingsProps) {
  const {
    permissionState,
    isSubscribed,
    isLoading,
    isIOSBrowserWithoutPWA,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications()

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isActionPending, setIsActionPending] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleEnable = async () => {
    setIsActionPending(true)
    const success = await subscribe()
    setIsActionPending(false)

    if (success) {
      showToast('Push notifications enabled! You will receive urgent crisis alerts.')
    } else if (permissionState === 'denied') {
      showToast('Notifications are blocked by your browser. Please allow them in site settings.')
    }
  }

  const handleDisable = async () => {
    setIsActionPending(true)
    const success = await unsubscribe()
    setIsActionPending(false)

    if (success) {
      showToast('Push notifications have been disabled.')
    }
  }

  const handleTestNotification = async () => {
    setIsActionPending(true)
    const success = await sendTestNotification(
      'ReliefLink Alert · High Urgency',
      'Drinking water consignment dispatched for 200 families. Real-time push verified!',
    )
    setIsActionPending(false)

    if (success) {
      showToast('Test notification sent! Check your device notification tray.')
    } else {
      showToast('Could not deliver test notification. Check permissions.')
    }
  }

  const getStatusBadge = () => {
    if (permissionState === 'unsupported') {
      return (
        <Badge variant="default" className="inline-flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-ink-muted" /> Unsupported
        </Badge>
      )
    }
    if (permissionState === 'denied') {
      return (
        <Badge variant="danger" className="inline-flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Blocked
        </Badge>
      )
    }
    if (isSubscribed) {
      return (
        <Badge variant="success" className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Subscribed
        </Badge>
      )
    }
    return (
      <Badge variant="default" className="inline-flex items-center gap-1">
        <BellOff className="w-3 h-3 text-ink-muted" /> Disabled
      </Badge>
    )
  }

  return (
    <Card className="p-4 sm:p-5 border border-slate-200/90 shadow-card bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-body font-bold text-ink leading-tight">
              Mobile Push Notifications
            </h3>
            <p className="text-[12px] text-ink-muted mt-0.5">
              Instant alerts for relief coordination & logistics
            </p>
          </div>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Explanation of Benefits */}
      {!compact && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 text-caption text-ink-muted space-y-2">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong className="text-ink">Critical Crisis Alerts:</strong> Immediate warnings when life-saving supplies, medical needs, or shelter tarps are requested near you.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong className="text-ink">Dispatch & Delivery Tracking:</strong> Real-time confirmation when your aid packages are accepted, en route, or delivered.
            </p>
          </div>
        </div>
      )}

      {/* iOS Special Instructions */}
      {isIOSBrowserWithoutPWA && (
        <div className="mt-3 p-3 rounded-card bg-amber-50 border border-amber-200 text-[12px] text-amber-900 flex items-start gap-2.5">
          <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">iOS Setup Required</p>
            <p className="mt-0.5 leading-relaxed text-amber-800">
              Apple requires web apps to be installed to your home screen before enabling push notifications. Tap the <span className="font-medium underline">Share</span> icon in Safari and select <span className="font-medium underline">Add to Home Screen</span>.
            </p>
          </div>
        </div>
      )}

      {/* Browser Blocked Instructions */}
      {permissionState === 'denied' && (
        <div className="mt-3 p-3 rounded-card bg-red-50 border border-red-200 text-[12px] text-red-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Notifications are blocked</p>
            <p className="mt-0.5 leading-relaxed text-red-800">
              Your browser has blocked notifications for ReliefLink. To receive alerts:
            </p>
            <ol className="list-decimal list-inside mt-1 space-y-0.5 text-[11px] text-red-800">
              <li>Click the lock or settings icon in your browser address bar</li>
              <li>Open <span className="font-semibold">Site settings</span> or <span className="font-semibold">Permissions</span></li>
              <li>Change <span className="font-semibold">Notifications</span> to <span className="font-semibold">Allow</span></li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      )}

      {/* Error display if any */}
      {error && permissionState !== 'denied' && !isIOSBrowserWithoutPWA && (
        <div className="mt-3 p-2.5 rounded-card bg-red-50 border border-red-200 text-[12px] text-danger">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        {isSubscribed ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestNotification}
              disabled={isLoading || isActionPending}
              className="inline-flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5 text-brand-600" />
              <span>Send Test Notification</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisable}
              disabled={isLoading || isActionPending}
              className="text-danger hover:bg-danger-bg hover:text-danger inline-flex items-center gap-1.5"
            >
              <BellOff className="w-3.5 h-3.5" />
              <span>Disable</span>
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleEnable}
            disabled={
              isLoading ||
              isActionPending ||
              permissionState === 'unsupported' ||
              isIOSBrowserWithoutPWA
            }
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            <span>Enable Push Notifications</span>
          </Button>
        )}
      </div>

      <Toast message={toastMessage || ''} visible={Boolean(toastMessage)} />
    </Card>
  )
}
