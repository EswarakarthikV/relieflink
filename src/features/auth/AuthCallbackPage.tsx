import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [status, setStatus] = useState<'verifying' | 'success' | 'already_confirmed' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function handleAuthVerification() {
      // 1. Check for error parameters in URL query or hash
      const queryError = searchParams.get('error')
      const queryErrorDesc = searchParams.get('error_description')
      const hash = window.location.hash.substring(1)
      const hashParams = new URLSearchParams(hash)
      const hashError = hashParams.get('error')
      const hashErrorDesc = hashParams.get('error_description')

      if (queryError || hashError) {
        if (!isMounted) return
        setStatus('error')
        setErrorMessage(
          queryErrorDesc ||
          hashErrorDesc ||
          'The verification link is invalid, expired, or was already used.'
        )
        return
      }

      if (!isSupabaseConfigured) {
        // Mock mode: simulate successful verification
        setTimeout(() => {
          if (!isMounted) return
          setUserEmail('volunteer@relieflink.org')
          setStatus('success')
        }, 800)
        return
      }

      try {
        // 2. Check for PKCE Authorization Code in query params
        const code = searchParams.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          if (!isMounted) return
          setUserEmail(data.user?.email || null)
          setStatus('success')
          return
        }

        // 3. Check for implicit access_token & refresh_token in URL hash
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          if (!isMounted) return
          setUserEmail(data.user?.email || null)
          setStatus('success')
          return
        }

        // 4. Fallback: check if active session already exists and is verified
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.user) {
          if (!isMounted) return
          setUserEmail(sessionData.session.user.email || null)
          setStatus('already_confirmed')
          return
        }

        // If neither code nor tokens exist, link might be expired or opened directly
        if (!isMounted) return
        setStatus('error')
        setErrorMessage('No valid confirmation token was found in this link. Please request a new verification email.')
      } catch (err: any) {
        console.error('Auth callback verification error:', err)
        if (!isMounted) return
        setStatus('error')
        setErrorMessage(err?.message || 'Failed to verify account. The link may have expired.')
      }
    }

    handleAuthVerification()

    return () => {
      isMounted = false
    }
  }, [searchParams])

  return (
    <div className="flex flex-col min-h-dvh bg-surface">
      {/* ── Navy Top Banner ── */}
      <div className="bg-navy-900 px-6 pt-12 pb-14 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-white/10 text-white text-caption mb-4">
          <ShieldCheck className="w-4 h-4 text-brand-100" />
          <span>Account Security Verification</span>
        </div>
        <h1 className="text-h1 font-semibold text-white tracking-tight">ReliefLink</h1>
        <p className="text-caption text-brand-100 mt-1">Humanitarian Logistics & Relief Grid</p>
      </div>

      {/* ── Content Card ── */}
      <div className="-mt-6 bg-surface rounded-t-[24px] flex-1 px-6 pt-8 pb-12 flex flex-col shadow-sheet max-w-lg mx-auto w-full">
        {status === 'verifying' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <PageSpinner label="Verifying your account security credentials…" />
          </div>
        )}

        {(status === 'success' || status === 'already_confirmed') && (
          <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center text-success">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-h2 font-semibold text-navy-900 tracking-tight">
                {status === 'success' ? 'Email Verified Successfully!' : 'Account Confirmed'}
              </h2>
              <p className="text-body text-ink-muted mt-2 leading-relaxed">
                {userEmail ? (
                  <>
                    Your email <strong className="text-navy-900 font-semibold">{userEmail}</strong> has been confirmed.
                  </>
                ) : (
                  'Your account has been confirmed.'
                )}{' '}
                You now have full access to ReliefLink on all devices.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5 pt-4">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/home')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Go to Home Grid
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/browse')}
              >
                Browse Needs & Drives
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-danger-bg flex items-center justify-center text-danger">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-h2 font-semibold text-navy-900 tracking-tight">
                Verification Failed
              </h2>
              <p className="text-body text-ink-muted mt-2 leading-relaxed">
                {errorMessage || 'This confirmation link is invalid or has expired.'}
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5 pt-4">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/login')}
              >
                Go to Sign In
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/')}
              >
                Continue as Guest
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
