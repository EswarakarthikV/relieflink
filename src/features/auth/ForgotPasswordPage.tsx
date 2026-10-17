import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setError('Please enter your email address')
      return
    }

    setIsLoading(true)
    try {
      if (isSupabaseConfigured) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: window.location.origin + '/update-password',
        })
        if (resetError) throw resetError
      }

      setMessage('If an account exists, a reset link has been sent to your email.')
      setEmail('')
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-surface">
      {/* ── Navy header ── */}
      <div className="bg-navy-900 px-6 pt-12 pb-14 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-card bg-white/10 flex items-center justify-center mb-4 text-white">
          <KeyRound className="w-8 h-8 text-brand-100" />
        </div>
        <h1 className="text-h1 font-semibold text-white tracking-tight">Forgot Password</h1>
        <p className="text-caption text-brand-100 mt-1">Reset access to your ReliefLink account</p>
      </div>

      {/* ── Form Card ── */}
      <div className="-mt-6 bg-surface rounded-t-[24px] flex-1 px-6 pt-8 pb-12 flex flex-col shadow-sheet max-w-lg mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-h2 font-semibold text-ink tracking-tight">Reset your password</h2>
          <p className="text-caption text-ink-muted mt-1 leading-relaxed">
            Enter the email address associated with your account. We will send you a secure magic link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="forgot-email"
            label="Email address"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            placeholder="you@example.com"
            autoComplete="email"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          {error && (
            <div className="bg-danger-bg border border-red-200 rounded-input p-3 text-caption text-danger">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-success-bg border border-green-200 rounded-input p-3 text-caption text-success font-medium">
              {message}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Send Reset Link
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
    </div>
  )
}
