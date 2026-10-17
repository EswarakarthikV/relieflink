import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Toast } from '@/components/ui/Toast'
import { StatusBadge } from '@/components/ui/Badge'
import { PushNotificationSettings } from '@/components/notifications/PushNotificationSettings'
import { LogOut, User, MapPin, Mail, Shield, Sparkles, ArrowRight, Lock, CheckCircle2 } from 'lucide-react'

export function ProfilePage() {
  const { user, upgradeAccount, signOut } = useAuth()
  const navigate = useNavigate()

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [upgradeEmail, setUpgradeEmail] = useState('')
  const [upgradePassword, setUpgradePassword] = useState('')
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  if (!user) return null

  const isAnonymous = Boolean(user.is_anonymous)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpgradeError(null)

    if (!upgradeEmail.trim()) {
      setUpgradeError('Please enter a valid email address')
      return
    }
    if (upgradePassword.length < 6) {
      setUpgradeError('Password must be at least 6 characters')
      return
    }

    setIsUpgrading(true)
    const { error } = await upgradeAccount(upgradeEmail.trim(), upgradePassword)
    setIsUpgrading(false)

    if (error) {
      setUpgradeError(error.message || 'Failed to save account. Please try again.')
    } else {
      setIsUpgradeModalOpen(false)
      setUpgradeEmail('')
      setUpgradePassword('')
      showToast('Account saved successfully! You can now log in from any device.')
    }
  }

  const STATS = [
    { label: 'Offers made',   value: 12 },
    { label: 'Kg delivered',  value: 480 },
    { label: 'Requests aided', value: 7 },
  ]

  return (
    <AppShell>
      <TopBar title="Profile" variant="navy" />

      <div className="pt-16 px-4 pb-12 space-y-4 max-w-lg mx-auto">
        {/* ── Guest Warning / Save Data Banner ── */}
        {isAnonymous && (
          <Card className="p-5 border border-brand-200 bg-brand-50/50 shadow-card flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-body font-bold text-navy-900 leading-snug">
                  Save your data
                </h3>
                <p className="text-caption text-ink-muted mt-1 leading-relaxed">
                  You are using a temporary guest account. Save your data to access it on other devices.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setUpgradeError(null)
                  setIsUpgradeModalOpen(true)
                }}
              >
                Save my account
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 text-ink-muted hover:text-navy-900"
                onClick={() => navigate('/login')}
              >
                I already have an account
              </Button>
            </div>
          </Card>
        )}

        {/* Avatar + name card */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center text-white text-h1 font-bold">
            {user.avatarInitials}
          </div>
          <div>
            <h2 className="text-h2 font-semibold text-ink">{user.name}</h2>
            <p className="text-caption text-ink-muted mt-0.5">
              {isAnonymous ? 'Temporary Guest Session' : user.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={isAnonymous ? 'pending' : 'accepted'} />
            <span className="text-caption text-ink-muted capitalize">
              {isAnonymous ? 'Guest' : user.role}
            </span>
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
            {
              Icon: Mail,
              label: 'Email',
              value: isAnonymous ? 'Not registered (Guest)' : user.email,
            },
            { Icon: MapPin, label: 'Location', value: user.location ?? '—' },
            { Icon: Shield, label: 'Account Type', value: isAnonymous ? 'Guest (Unsaved)' : 'Verified Member' },
            { Icon: User, label: 'Member since', value: new Date(user.createdAt).getFullYear().toString() },
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

        {/* Push Notification Preferences */}
        <PushNotificationSettings />

        {/* Sign out */}
        <Button
          variant="secondary"
          fullWidth
          leftIcon={<LogOut className="w-4 h-4" />}
          onClick={signOut}
        >
          Sign Out
        </Button>
      </div>

      {/* ── Save Account / Upgrade Modal ── */}
      <Modal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Save Your Account"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpgradeSubmit} className="flex flex-col gap-4 select-text">
          <p className="text-caption text-ink-muted leading-relaxed">
            Convert your current session into a permanent ReliefLink account. Your requests, drives, and donation history will be preserved.
          </p>

          <Input
            id="upgrade-email"
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={upgradeEmail}
            onChange={e => setUpgradeEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />

          <Input
            id="upgrade-password"
            label="Create password"
            type="password"
            placeholder="At least 6 characters"
            value={upgradePassword}
            onChange={e => setUpgradePassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="new-password"
          />

          {upgradeError && (
            <div className="bg-danger-bg border border-red-200 rounded-input p-3 text-caption text-danger">
              {upgradeError}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setIsUpgradeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isUpgrading}
              rightIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Save Account
            </Button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </AppShell>
  )
}
