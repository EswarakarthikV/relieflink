import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Truck, Plus, Calendar, MapPin, ChevronRight, PackageOpen } from 'lucide-react'
import { useDrives } from '@/hooks/useDrives'

export function BrowseDrivesPage() {
  const navigate = useNavigate()
  const { data: drives = [], isLoading, isError, refetch } = useDrives()

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    } catch {
      return dateStr
    }
  }

  return (
    <AppShell>
      <TopBar title="Collection Drives" variant="navy" />
      <div className="pt-20 px-4 pb-24 max-w-2xl mx-auto flex flex-col gap-6">
        {/* Header Action Bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-h2 font-semibold text-navy-900 tracking-tight">Collection Drives</h1>
            <p className="text-caption text-ink-muted mt-0.5">
              Community-organized hubs delivering supplies directly to camps
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/drives/create')}
            className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Start a drive</span>
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <PageSpinner label="Loading collection drives…" />
        ) : isError ? (
          <Card className="p-8 text-center flex flex-col items-center gap-3">
            <p className="text-body font-semibold text-danger">Failed to load drives</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </Card>
        ) : drives.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center gap-4 bg-surface/50">
            <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
              <PackageOpen className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-h3 font-semibold text-navy-900">No active collection drives</h2>
              <p className="text-caption text-ink-muted max-w-sm">
                Be the first to mobilize a relief vehicle and collect supplies from your neighborhood.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate('/drives/create')}
              className="bg-brand-600 hover:bg-brand-700 text-white"
            >
              Start a collection drive
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3.5">
            {drives.map(drive => (
              <Card
                key={drive.id}
                as="div"
                noPadding
                onClick={() => navigate(`/drives/${drive.id}`)}
                className="p-4 rounded-card border border-slate-200 bg-surface hover:border-brand-600 hover:shadow-md transition-all cursor-pointer flex flex-col gap-3 group active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-input bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      {/* "Erode → Chennai" (16px semibold navy) */}
                      <h3 className="text-[16px] font-semibold text-navy-900 group-hover:text-brand-600 transition-colors">
                        {drive.from_city} → {drive.to_city}
                      </h3>
                      {/* "For: Chennai Flood Relief" (ink-muted) */}
                      <p className="text-caption text-ink-muted">
                        For: {drive.destination_event}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-success-bg text-success uppercase tracking-wider shrink-0">
                    {drive.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted border-t border-slate-100 pt-2.5">
                  {/* "Leaves: 20 Oct" (ink-muted) */}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    Leaves: {formatDate(drive.departure_date)}
                  </span>

                  {/* "Vehicle: Truck · 500 kg" (ink-muted) */}
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    Vehicle: {drive.vehicle_type} · {drive.capacity_kg} kg
                  </span>
                </div>

                {/* "Needs: Water, Blankets" (chips) */}
                {drive.needs && drive.needs.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-[12px] font-semibold text-ink-muted">Needs:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {drive.needs.map(need => (
                        <span
                          key={need}
                          className="text-[11px] font-medium bg-surface-low border border-slate-200 text-ink px-2 py-0.5 rounded-pill"
                        >
                          {need}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
