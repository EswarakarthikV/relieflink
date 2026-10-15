import { useState, useCallback } from 'react'
import type { User } from '@/types'

// ── Mock user for development (replace with real Supabase auth) ───────────
const MOCK_USER: User = {
  id: 'usr-001',
  email: 'priya@field.relieflink.org',
  name: 'Priya Sharma',
  role: 'donor',
  avatarInitials: 'PS',
  location: 'Pune Sector 4',
  createdAt: new Date().toISOString(),
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: MOCK_USER,   // pre-authenticated for dev
    isLoading: false,
    isAuthenticated: true,
    error: null,
  })

  const signIn = useCallback(async (email: string, _password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      // Replace with: await supabase.auth.signInWithPassword({ email, password })
      await new Promise(r => setTimeout(r, 800))
      setState({
        user: { ...MOCK_USER, email },
        isLoading: false,
        isAuthenticated: true,
        error: null,
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Sign in failed',
      }))
    }
  }, [])

  const signOut = useCallback(async () => {
    setState({ user: null, isLoading: false, isAuthenticated: false, error: null })
  }, [])

  return { ...state, signIn, signOut }
}
