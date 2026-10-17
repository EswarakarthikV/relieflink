import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, KeyRound, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialEmail = searchParams.get('email') || ''

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedCode = code.trim()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Please provide your email address')
      return
    }
    if (!trimmedCode) {
      setError('Please enter the 6-digit code sent to your email')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      if (isSupabaseConfigured) {
        // Step 1: verify OTP with type recovery
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: trimmedCode,
          type: 'recovery',
        })
        if (otpError) throw otpError

        // Step 2: update user password
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        })
        if (updateError) throw updateError
      }

      setToastMessage('Password updated. You can now log in.')
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. Please check the code and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-surface">
      {/* ── Navy header ── */}
      <div className="bg-navy-900 px-6 pt-12 pb-14 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-card bg-white/10 flex items-center justify-center mb-4 text-white">
          <Lock className="w-8 h-8 text-brand-100" />
        </div>
        <h1 className="text-h1 font-semibold text-white tracking-tight">Set New Password</h1>
        <p className="text-caption text-brand-100 mt-1">Verify your 6-digit code and create a new password</p>
      </div>

      {/* ── Form Card ── */}
      <div className="-mt-6 bg-surface rounded-t-[24px] flex-1 px-6 pt-8 pb-12 flex flex-col shadow-sheet max-w-lg mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-h2 font-semibold text-ink tracking-tight">Reset password</h2>
          <p className="text-caption text-ink-muted mt-1 leading-relaxed">
            {email ? (
              <>
                A recovery code was sent to <strong className="text-ink font-semibold">{email}</strong>.
              </>
            ) : (
              'Enter the verification code and your new password below.'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!initialEmail && (
            <Input
              id="reset-email"
              label="Email address"
              type="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          )}

          <Input
            id="reset-code"
            label="Enter 6-digit code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => {
              setCode(e.target.value)
              if (error) setError(null)
            }}
            placeholder="e.g. 123456"
            autoComplete="one-time-code"
            leftIcon={<KeyRound className="w-4 h-4" />}
            required
          />

          <Input
            id="reset-password"
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={e => {
              setNewPassword(e.target.value)
              if (error) setError(null)
            }}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            leftIcon={<Lock className="w-4 h-4" />}
            required
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="text-ink-muted hover:text-ink text-caption"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />

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
            rightIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Reset Password
          </Button>

          <div className="text-center pt-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-caption font-semibold text-brand-600 hover:underline min-h-touch py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </Link>
          </div>
        </form>
      </div>

      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </div>
  )
}
