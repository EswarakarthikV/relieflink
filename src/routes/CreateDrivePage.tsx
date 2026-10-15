import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Truck } from 'lucide-react'

export function CreateDrivePage() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <TopBar title="New Collection Drive" showBack variant="navy" />
      <div className="pt-16 px-4 pb-6 lg:pt-0 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-input bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-h2 font-semibold text-navy-900 leading-tight">New Collection Drive</h1>
            <p className="text-caption text-ink-muted mt-0.5">
              Organize grassroots drop-off hubs and relief deliveries
            </p>
          </div>
        </div>

        <Card className="border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center gap-4 bg-surface/50">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
            <Truck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-h3 font-semibold text-navy-900">Collection Drive creator coming soon</h2>
            <p className="text-caption text-ink-muted max-w-sm">
              We are finalizing route scheduling, drop-off verification, and vehicle dispatching for community collection drives.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </Card>
      </div>
    </AppShell>
  )
}
