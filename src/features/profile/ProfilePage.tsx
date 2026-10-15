import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { LogOut, User, MapPin, Mail, Shield } from 'lucide-react'

export function ProfilePage() {
  const { user, signOut } = useAuth()

  if (!user) return null

  const STATS = [
    { label: 'Offers made',   value: 12 },
    { label: 'Kg delivered',  value: 480 },
    { label: 'Requests aided', value: 7 },
  ]

  return (
    <AppShell>
      <TopBar title="Profile" variant="navy" />

      <div className="pt-16 px-4 pb-6 space-y-4">
        {/* Avatar + name card */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center text-white text-h1 font-bold">
            {user.avatarInitials}
          </div>
          <div>
            <h2 className="text-h2 font-semibold text-ink">{user.name}</h2>
            <p className="text-caption text-ink-muted mt-0.5">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status="accepted" />
            <span className="text-caption text-ink-muted capitalize">{user.role}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {STATS.map(s => (
            <div key={s.label} className="bg-surface rounded-card border border-slate-200/80 shadow-card p-3 text-center">
              <p className="text-h2 font-semibold text-ink tnum">{s.value}</p>
              <p className="text-[11px] font-medium text-ink-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info items */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card overflow-hidden">
          {[
            { Icon: Mail,    label: 'Email',    value: user.email },
            { Icon: MapPin,  label: 'Location', value: user.location ?? '—' },
            { Icon: Shield,  label: 'Role',     value: user.role },
            { Icon: User,    label: 'Member since', value: new Date(user.createdAt).getFullYear().toString() },
          ].map(({ Icon, label, value }, i, arr) => (
            <div
              key={label}
              className={`flex items-center gap-3 p-4 min-h-[56px] ${i < arr.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">{label}</p>
                <p className="text-body font-medium text-ink truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <Button
          variant="secondary"
          fullWidth
          leftIcon={<LogOut className="w-4 h-4" />}
          onClick={signOut}
        >
          Sign out
        </Button>
      </div>
    </AppShell>
  )
}
