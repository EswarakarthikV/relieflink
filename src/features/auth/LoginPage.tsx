import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const { signIn, isLoading, error } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password')
      return
    }

    const { error: signInErr } = await signIn(email.trim(), password)
    if (signInErr) {
      setLocalError(signInErr.message || 'Invalid email or password')
      return
    }

    navigate('/')
  }

  const handleGuestContinue = () => {
    navigate('/')
  }

  return (
    <div className="flex flex-col min-h-dvh bg-surface">
      {/* ── Navy header (top ~40%) ──────────────────────────────────── */}
      <div className="bg-navy-900 px-6 pt-12 pb-14 flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Status badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-white/10 text-white text-caption mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-100" />
          Field Telemetry Active · UN OCHA Standard
        </div>

        {/* Logo / wordmark */}
        <div className="w-16 h-16 rounded-card bg-white/10 flex items-center justify-center mb-4">
          <svg className="w-9 h-9 text-brand-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            <path d="M12 5v6" /><path d="M9 8h6" />
          </svg>
        </div>

        <h1 className="text-h1 font-semibold text-white tracking-tight">ReliefLink</h1>
        <p className="text-caption text-brand-100 mt-1">Rapid Logistics & Humanitarian Supply Grid</p>
      </div>

      {/* ── White bottom sheet overlapping ─────────────────────────── */}
      <div className="-mt-6 bg-surface rounded-t-[24px] flex-1 px-6 pt-8 pb-8 flex flex-col shadow-sheet max-w-lg mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-h2 font-semibold text-ink tracking-tight">Welcome back</h2>
          <p className="text-caption text-ink-muted mt-1">Sign in to access your registered relief account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="login-email"
            label="Email"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (localError) setLocalError(null)
            }}
            placeholder="you@example.com"
            autoComplete="email"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            id="login-password"
            label="Password"
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (localError) setLocalError(null)
            }}
            placeholder="••••••••"
            autoComplete="current-password"
            leftIcon={<Lock className="w-4 h-4" />}
            required
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="text-ink-muted hover:text-ink text-caption"
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            }
          />

          <div className="flex justify-end -mt-1">
            <Link
              to="/forgot-password"
              className="text-caption font-medium text-brand-600 hover:underline min-h-touch inline-flex items-center"
            >
              Forgot password?
            </Link>
          </div>

          {(localError || error) && (
            <div className="bg-danger-bg border border-red-200 rounded-input p-3 text-caption text-danger">
              {localError || error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full h-px bg-slate-200 absolute" />
          <span className="relative bg-surface px-3 text-caption text-ink-muted uppercase tracking-wider">or</span>
        </div>

        {/* Guest Link option */}
        <div className="text-center space-y-3">
          <button
            type="button"
            onClick={handleGuestContinue}
            className="w-full py-3 px-4 rounded-input border border-slate-200 bg-surface-low hover:bg-slate-50 text-body font-medium text-navy-900 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <span>New here? Use the app as a guest</span>
            <ArrowRight className="w-4 h-4 text-brand-600" />
          </button>

          <p className="text-caption text-ink-muted text-[12px] pt-2">
            🔒 End-to-end encrypted humanitarian coordination
          </p>
        </div>
      </div>
    </div>
  )
}
