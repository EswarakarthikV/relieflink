import { Link } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { CardSkeleton } from '@/components/ui/Card'
import { RequestCard } from '@/features/requests/RequestCard'
import { useAuth } from '@/hooks/useAuth'
import { useMyRequests } from '@/hooks/useRequests'

export function MyRequestsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const { data: myRequests = [], isLoading: isRequestsLoading } = useMyRequests(user?.id)

  const isLoading = isAuthLoading || isRequestsLoading

  return (
    <AppShell>
      <TopBar title="My Requests" variant="navy" />

      <div className="pt-16 pb-20">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-h2 font-semibold text-ink">My Requests</h1>
            <p className="text-caption text-ink-muted mt-0.5">
              Track fulfillment progress and updates on requests you created
            </p>
          </div>
          <Link to="/create">
            <Button size="sm" variant="primary" className="gap-1">
              <Plus className="w-4 h-4" />
              <span>New</span>
            </Button>
          </Link>
        </div>

        {/* List or Empty State */}
        <section aria-label="My Requests List" className="flex flex-col gap-4 px-4 pt-3">
          {isLoading ? (
            [0, 1, 2].map(i => <CardSkeleton key={i} />)
          ) : myRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-surface rounded-card border border-slate-200/80 shadow-card mt-2">
              <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-4">
                <ClipboardList className="w-8 h-8" />
              </div>
              <h2 className="text-h3 font-semibold text-ink mb-1.5">No requests yet</h2>
              <p className="text-caption text-ink-muted max-w-xs mb-6">
                You haven't posted any disaster relief requests yet. When you do, you can track their fulfillment status here.
              </p>
              <Link to="/create">
                <Button variant="primary">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create your first request
                </Button>
              </Link>
            </div>
          ) : (
            myRequests.map(req => (
              <RequestCard key={req.id} request={req} trackLink />
            ))
          )}
        </section>
      </div>
    </AppShell>
  )
}
