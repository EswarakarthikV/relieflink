import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, ArrowRight, User as UserIcon, CheckCircle2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const { signIn, signUp, isLoading, error } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both email and password')
      return
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long')
        return
      }

      setIsSubmitting(true)
      const res = await signUp(
        trimmedEmail,
        password,
        fullName.trim() || undefined
      )
      setIsSubmitting(false)

      if (res.error) {
        setLocalError(res.error.message || 'Failed to create account. Please try again.')
        return
      }

      // Show clear "Check your email" confirmation screen with registered email
      setSignupSuccessEmail(trimmedEmail)
      return
    }

    // Sign in flow
    setIsSubmitting(true)
    const { error: signInErr } = await signIn(trimmedEmail, password)
    setIsSubmitting(false)

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

        {signupSuccessEmail ? (
          /* ── Check Your Email Confirmation Screen ── */
          <div className="py-4 text-center space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 text-success flex items-center justify-center mx-auto shadow-sm">
              <Mail className="w-8 h-8 text-success" />
            </div>

            <div>
              <h2 className="text-h2 font-semibold text-navy-900 tracking-tight">Check your email</h2>
              <p className="text-body text-ink-muted mt-2">
                We sent a confirmation link to:
              </p>
              <div className="mt-2.5">
                <span className="font-mono text-body font-semibold text-navy-900 bg-brand-50 border border-brand-200 px-3.5 py-1.5 rounded-input inline-block break-all">
                  {signupSuccessEmail}
                </span>
              </div>
            </div>

            <div className="bg-surface-low border border-slate-200 rounded-card p-4 text-left text-caption text-ink space-y-2 mt-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                <span>Open the link in your email to automatically verify your account.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                <span>Once verified, you will be able to log in securely and track relief contributions.</span>
              </div>
            </div>

            <div className="pt-4 space-y-2.5">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  setSignupSuccessEmail(null)
                  setMode('signin')
                  setLocalError(null)
                }}
              >
                Back to Sign In
              </Button>

              <button
                type="button"
                onClick={handleGuestContinue}
                className="w-full text-caption text-ink-muted hover:text-navy-900 py-2 font-medium"
              >
                Continue using app as guest for now
              </button>
            </div>
          </div>
        ) : (
          /* ── Regular Tabbed Auth Form ── */
          <>
            {/* Toggle tabs */}
            <div className="flex rounded-pill bg-slate-100 p-1 mb-6 border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setLocalError(null)
                }}
                className={`flex-1 py-2 text-caption font-semibold rounded-pill transition-all ${
                  mode === 'signin'
                    ? 'bg-white text-navy-900 shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setLocalError(null)
                }}
                className={`flex-1 py-2 text-caption font-semibold rounded-pill transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-navy-900 shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-h2 font-semibold text-ink tracking-tight">
                {mode === 'signin' ? 'Welcome back' : 'Join ReliefLink'}
              </h2>
              <p className="text-caption text-ink-muted mt-1">
                {mode === 'signin'
                  ? 'Sign in to access your registered relief account'
                  : 'Register to coordinate supplies, collection drives, and direct aid'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'signup' && (
                <Input
                  id="signup-fullname"
                  label="Full Name"
                  type="text"
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value)
                    if (localError) setLocalError(null)
                  }}
                  placeholder="e.g. Ramesh Kumar or Red Cross Team"
                  autoComplete="name"
                  leftIcon={<UserIcon className="w-4 h-4" />}
                />
              )}

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
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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

              {mode === 'signin' && (
                <div className="flex justify-end -mt-1">
                  <Link
                    to="/forgot-password"
                    className="text-caption font-medium text-brand-600 hover:underline min-h-touch inline-flex items-center"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {(localError || error) && (
                <div className="bg-danger-bg border border-red-200 rounded-input p-3 text-caption text-danger">
                  {localError || error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading || isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
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
          </>
        )}
      </div>
    </div>
  )
}
