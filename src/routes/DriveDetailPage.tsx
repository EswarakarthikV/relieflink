import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Toast } from '@/components/ui/Toast'
import {
  Truck,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Package,
} from 'lucide-react'
import { useDrive } from '@/hooks/useDrives'
import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function DriveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: drive, isLoading, isError } = useDrive(id)

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Query contributed offers targeting this drive
  const { data: contributedKg = 0 } = useQuery<number>({
    queryKey: ['drive_contributions', id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !id) return 0
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('quantity_offered')
          .eq('drive_id', id)

        if (!error && data) {
          return data.reduce((sum, o) => sum + (Number(o.quantity_offered) || 0), 0)
        }
      } catch (err) {
        console.warn('Error querying drive contributions:', err)
      }
      return 0
    },
    enabled: Boolean(id),
  })

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const handleContribute = () => {
    setToastMessage('Contribution logged! Drop off at the main camp.')
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }

  if (isLoading) {
    return (
      <AppShell>
        <TopBar title="Collection Drive" showBack variant="navy" />
        <div className="pt-20">
          <PageSpinner label="Loading drive details…" />
        </div>
      </AppShell>
    )
  }

  if (isError || !drive) {
    return (
      <AppShell>
        <TopBar title="Not Found" showBack variant="navy" />
        <div className="pt-20 px-4 flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mb-3" />
          <h2 className="text-h3 font-semibold text-ink">Drive not found</h2>
          <p className="text-caption text-ink-muted mt-1 mb-4">
            This collection drive might have been concluded or cancelled.
          </p>
          <Button variant="secondary" onClick={() => navigate('/drives')}>
            Browse all drives
          </Button>
        </div>
      </AppShell>
    )
  }

  const capacity = drive.capacity_kg || 500
  const progressRatio = capacity > 0 ? Math.min(1, contributedKg / capacity) : 0

  const collectorName =
    drive.profiles?.full_name || drive.collector_name || 'Community Organizer'

  return (
    <AppShell>
      <TopBar title="Drive Details" showBack variant="navy" />
      <div className="pt-20 px-4 pb-28 max-w-xl mx-auto flex flex-col gap-5">
        {/* Route Banner Card */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-brand-600 bg-brand-100 px-2.5 py-0.5 rounded-pill">
              Collection Drive
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-success-bg text-success uppercase tracking-wider">
              {drive.status}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-card bg-navy-900 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-h2 font-bold text-navy-900 leading-snug flex items-center gap-2">
                <span>{drive.from_city}</span>
                <ArrowRight className="w-5 h-5 text-ink-muted shrink-0" />
                <span>{drive.to_city}</span>
              </h1>
              <p className="text-caption font-medium text-ink-muted">
                For: <span className="text-ink font-semibold">{drive.destination_event}</span>
              </p>
              <div className="pt-1.5">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    drive.to_city || drive.destination_event || ''
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-brand-600 hover:underline font-medium inline-flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Get directions to destination ↗</span>
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Collection Capacity Progress */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-3">
          <div className="flex items-center justify-between text-body">
            <span className="font-semibold text-navy-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Collection Progress
            </span>
            <span className="text-caption font-bold text-brand-600">
              {Math.round(progressRatio * 100)}%
            </span>
          </div>

          <ProgressBar
            value={progressRatio}
            color="brand"
            size="md"
          />

          <div className="flex items-center justify-between text-caption text-ink-muted">
            <span>{contributedKg} kg collected</span>
            <span>{capacity} kg vehicle capacity</span>
          </div>
        </Card>

        {/* Schedule & Vehicle Specifications */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-3.5">
          <h2 className="text-body font-semibold text-navy-900 border-b border-slate-100 pb-2.5">
            Logistics & Schedule
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Departure Date
              </span>
              <span className="text-body font-semibold text-navy-900 mt-0.5">
                {formatDate(drive.departure_date)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-brand-600" />
                Vehicle Type
              </span>
              <span className="text-body font-semibold text-navy-900 mt-0.5">
                {drive.vehicle_type}
              </span>
            </div>
          </div>
        </Card>

        {/* Supplies Needed */}
        <Card className="p-5 border border-slate-200 shadow-card flex flex-col gap-3">
          <h2 className="text-body font-semibold text-navy-900 border-b border-slate-100 pb-2.5">
            Supplies Needed
          </h2>
          {drive.needs && drive.needs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {drive.needs.map(need => (
                <span
                  key={need}
                  className="px-3 py-1 rounded-pill text-caption font-medium bg-brand-100/60 border border-brand-200 text-navy-900"
                >
                  {need}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-caption text-ink-muted">All essential disaster relief supplies welcome.</p>
          )}
        </Card>

        {/* Organizer info */}
        <Card className="p-5 border border-slate-200 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-caption shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-wider text-ink-muted font-semibold">
                Organized by
              </p>
              <p className="text-body font-semibold text-navy-900 leading-tight">
                {collectorName}
              </p>
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-success" />
        </Card>

        {/* Sticky / Bottom Action Button */}
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleContribute}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 shadow-md"
          >
            I want to contribute to this drive
          </Button>
        </div>
      </div>

      {/* Contribution Toast */}
      <Toast
        message={toastMessage}
        visible={Boolean(toastMessage)}
        variant="success"
      />
    </AppShell>
  )
}
