import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { useRequests } from '@/hooks/useRequests'
import { UrgencyBadge, StatusBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Link } from 'react-router-dom'
import { fulfillmentRatio, fmtNumber } from '@/utils/format'
import { sortByUrgency } from '@/utils/urgency'
import { BarChart2, Users, Package, AlertTriangle } from 'lucide-react'

export function AdminDashboard() {
  const { data, isLoading } = useRequests()
  const requests = sortByUrgency(data?.data ?? [])

  const totalRequests  = requests.length
  const openRequests   = requests.filter(r => r.status !== 'fulfilled' && r.status !== 'closed').length
  const criticalCount  = requests.filter(r => r.urgency === 'critical').length
  const totalDonors    = requests.reduce((s, r) => s + r.donorCount, 0)

  return (
    <AppShell>
      <TopBar title="Admin Dashboard" variant="navy" />

      <div className="pt-16 px-4 pb-6 space-y-4">
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { label: 'Total Requests', value: totalRequests,  Icon: Package,       bg: 'bg-brand-100',   color: 'text-brand-600' },
            { label: 'Open',           value: openRequests,   Icon: AlertTriangle, bg: 'bg-warning-bg',  color: 'text-warning'   },
            { label: 'Critical',       value: criticalCount,  Icon: BarChart2,     bg: 'bg-danger-bg',   color: 'text-danger'    },
            { label: 'Total Donors',   value: totalDonors,    Icon: Users,         bg: 'bg-success-bg',  color: 'text-success'   },
          ].map(({ label, value, Icon, bg, color }) => (
            <div key={label} className="bg-surface rounded-card border border-slate-200/80 shadow-card p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption text-ink-muted">{label}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <p className="text-h1 font-bold text-ink tnum">{value}</p>
            </div>
          ))}
        </div>

        {/* All requests table */}
        <div>
          <h2 className="text-h4 font-semibold text-ink mb-3">All Requests</h2>
          {isLoading
            ? <p className="text-caption text-ink-muted">Loading…</p>
            : (
              <div className="bg-surface rounded-card border border-slate-200/80 shadow-card overflow-hidden">
                {requests.map((req, i) => {
                  const total   = req.items.reduce((s, it) => s + it.quantityRequested, 0)
                  const commit  = req.items.reduce((s, it) => s + it.quantityCommitted,  0)
                  return (
                    <Link
                      key={req.id}
                      to={`/requests/${req.id}`}
                      className={`flex flex-col gap-2 p-4 hover:bg-slate-50 transition-colors ${i < requests.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-caption font-mono text-ink-muted">{req.refNumber}</span>
                        <div className="flex items-center gap-2">
                          <UrgencyBadge urgency={req.urgency} />
                          <StatusBadge status={req.status as 'open' | 'fulfilled'} />
                        </div>
                      </div>
                      <p className="text-body font-medium text-ink leading-snug">{req.title}</p>
                      <ProgressBar
                        value={fulfillmentRatio(commit, total)}
                        rightLabel={`${fmtNumber(commit)} / ${fmtNumber(total)}`}
                        size="sm"
                        showPercent
                      />
                    </Link>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>
    </AppShell>
  )
}
