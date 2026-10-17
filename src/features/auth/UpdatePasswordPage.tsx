import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function UpdatePasswordPage() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      if (isSupabaseConfigured) {
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
      setError(err?.message || 'Failed to update password. The link may have expired.')
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
        <h1 className="text-h1 font-semibold text-white tracking-tight">Create New Password</h1>
        <p className="text-caption text-brand-100 mt-1">Set a new secure password for your ReliefLink account</p>
      </div>

      {/* ── Form Card ── */}
      <div className="-mt-6 bg-surface rounded-t-[24px] flex-1 px-6 pt-8 pb-12 flex flex-col shadow-sheet max-w-lg mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-h2 font-semibold text-ink tracking-tight">Update password</h2>
          <p className="text-caption text-ink-muted mt-1 leading-relaxed">
            Please enter your new password below. Once updated, you will be redirected to the app.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="new-password"
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
            Update Password
          </Button>
        </form>
      </div>

      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </div>
  )
}
