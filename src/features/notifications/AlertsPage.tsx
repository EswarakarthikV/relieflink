import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Toast } from '@/components/ui/Toast'
import { Package, CheckCircle, Truck, AlertTriangle } from 'lucide-react'
import { relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { useNotifications, setMockNotificationsRead } from '@/hooks/useNotifications'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

const ICON_MAP: Record<string, { Icon: typeof Package; bg: string; color: string }> = {
  offer_received: { Icon: Package,       bg: 'bg-brand-100',   color: 'text-brand-600' },
  offer_accepted: { Icon: CheckCircle,   bg: 'bg-success-bg',  color: 'text-success'   },
  dispatched:     { Icon: Truck,         bg: 'bg-warning-bg',  color: 'text-warning'   },
  delivered:      { Icon: CheckCircle,   bg: 'bg-success-bg',  color: 'text-success'   },
  new_request:    { Icon: AlertTriangle, bg: 'bg-danger-bg',   color: 'text-danger'    },
}

export function AlertsPage() {
  const { notifications } = useNotifications()
  const [toastVisible, setToastVisible] = useState(false)

  const handleMarkAllRead = async () => {
    try {
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data?.user?.id
      if (userId) {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .is('read_at', null) // only unread
          .eq('user_id', userId)
      }
    } catch (err) {
      console.warn('Error updating notifications in Supabase:', err)
    }

    setMockNotificationsRead(true)
    await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    setToastVisible(true)
    setTimeout(() => {
      setToastVisible(false)
    }, 3000)
  }

  return (
    <AppShell>
      <TopBar
        title="Alerts"
        variant="navy"
      />

      <div className="pt-16">
        {/* Header row */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-h4 font-semibold text-ink">Notifications</h2>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-caption font-medium text-brand-600 hover:underline min-h-touch inline-flex items-center"
          >
            Mark all read
          </button>
        </div>

        {/* Notification list */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card mx-4 overflow-hidden">
          {notifications.map((notif, i) => {
            const meta = ICON_MAP[notif.type] ?? ICON_MAP['new_request']
            const { Icon } = meta
            return (
              <div
                key={notif.id}
                className={cn(
                  'flex items-start gap-3 p-4 min-h-[64px] transition-colors',
                  !notif.isRead && 'bg-brand-100/30',
                  i < notifications.length - 1 && 'border-b border-slate-100',
                )}
              >
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.bg)}>
                  <Icon className={cn('w-4 h-4', meta.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-caption font-semibold text-ink', notif.isRead && 'font-medium')}>
                      {notif.title}
                    </p>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-caption text-ink-muted mt-0.5 leading-relaxed">{notif.body}</p>
                  <p className="text-[11px] text-ink-muted mt-1.5">{relativeTime(notif.createdAt)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty state fallback */}
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <p className="text-h3 font-semibold text-ink mb-2">All caught up</p>
            <p className="text-caption text-ink-muted">No new alerts right now.</p>
          </div>
        )}
      </div>

      <Toast message="All notifications marked as read" visible={toastVisible} />
    </AppShell>
  )
}
