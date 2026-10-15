import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const { signIn, isLoading, error } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('priya@field.relieflink.org')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await signIn(email, password)
    navigate('/home')
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
      <div className="-mt-6 bg-surface rounded-t-[24px] flex-1 px-6 pt-8 pb-8 flex flex-col shadow-sheet">
        <div className="mb-6">
          <h2 className="text-h2 font-semibold text-ink tracking-tight">Welcome back</h2>
          <p className="text-caption text-ink-muted mt-1">Sign in to coordinate relief supplies</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Password"
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            leftIcon={<Lock className="w-4 h-4" />}
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

          <div className="flex justify-end -mt-2">
            <a href="#forgot" className="text-caption font-medium text-brand-600 hover:underline min-h-touch inline-flex items-center">
              Forgot password?
            </a>
          </div>

          {error && (
            <div className="bg-danger-bg border border-red-200 rounded-input p-3 text-caption text-danger">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Sign in
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full h-px bg-slate-200 absolute" />
          <span className="relative bg-surface px-3 text-caption text-ink-muted uppercase tracking-wider">or</span>
        </div>

        {/* Google auth placeholder */}
        <button
          type="button"
          className="w-full h-12 bg-surface border border-slate-200 rounded-input flex items-center justify-center gap-3 text-body text-ink hover:bg-slate-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Signup prompt */}
        <p className="text-center mt-6 text-body text-ink-muted">
          New to ReliefLink?{' '}
          <a href="#register" className="font-semibold text-brand-600 hover:underline">Create an account</a>
        </p>

        {/* Security footnote */}
        <p className="text-center mt-4 text-caption text-ink-muted text-[12px]">
          🔒 End-to-end encrypted crisis communication
        </p>
      </div>
    </div>
  )
}
