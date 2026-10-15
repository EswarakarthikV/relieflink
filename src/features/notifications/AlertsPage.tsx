import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Package, CheckCircle, Truck, AlertTriangle } from 'lucide-react'
import { relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Notification } from '@/types'

// ── Mock notifications ────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS: Notification[] = [
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

const ICON_MAP: Record<string, { Icon: typeof Package; bg: string; color: string }> = {
  offer_received: { Icon: Package,       bg: 'bg-brand-100',   color: 'text-brand-600' },
  offer_accepted: { Icon: CheckCircle,   bg: 'bg-success-bg',  color: 'text-success'   },
  dispatched:     { Icon: Truck,         bg: 'bg-warning-bg',  color: 'text-warning'   },
  delivered:      { Icon: CheckCircle,   bg: 'bg-success-bg',  color: 'text-success'   },
  new_request:    { Icon: AlertTriangle, bg: 'bg-danger-bg',   color: 'text-danger'    },
}

export function AlertsPage() {
  const unread = MOCK_NOTIFICATIONS.filter(n => !n.isRead).length

  return (
    <AppShell>
      <TopBar
        title="Alerts"
        variant="navy"
        rightSlot={
          unread > 0 ? (
            <span className="px-2 py-0.5 rounded-pill bg-danger text-white text-caption font-bold min-w-[24px] text-center">
              {unread}
            </span>
          ) : undefined
        }
      />

      <div className="pt-16">
        {/* Header row */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-h4 font-semibold text-ink">Notifications</h2>
          <button className="text-caption font-medium text-brand-600 hover:underline min-h-touch inline-flex items-center">
            Mark all read
          </button>
        </div>

        {/* Notification list */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card mx-4 overflow-hidden">
          {MOCK_NOTIFICATIONS.map((notif, i) => {
            const meta = ICON_MAP[notif.type] ?? ICON_MAP['new_request']
            const { Icon } = meta
            return (
              <div
                key={notif.id}
                className={cn(
                  'flex items-start gap-3 p-4 min-h-[64px] transition-colors',
                  !notif.isRead && 'bg-brand-100/30',
                  i < MOCK_NOTIFICATIONS.length - 1 && 'border-b border-slate-100',
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
        {MOCK_NOTIFICATIONS.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <p className="text-h3 font-semibold text-ink mb-2">All caught up</p>
            <p className="text-caption text-ink-muted">No new alerts right now.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
