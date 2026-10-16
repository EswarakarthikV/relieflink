import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    // Step 1: On mount
    // 1. Calls supabase.auth.getSession()
    // 2. If session is null, calls supabase.auth.signInAnonymously()
    // 3. Logs the result: console.log('Anon sign-in:', data, error)
    // 4. Subscribes to onAuthStateChange
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously()
          console.log('Anon sign-in:', data, error)
          if (data?.user) {
            setUser({
              id: data.user.id,
              email: data.user.email ?? 'anonymous@relieflink.org',
              name: data.user.user_metadata?.full_name ?? 'Field Volunteer',
              role: 'donor',
              avatarInitials: 'FV',
              location: 'Pune',
              createdAt: data.user.created_at,
            })
          }
        } else if (session.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? 'anonymous@relieflink.org',
            name: session.user.user_metadata?.full_name ?? (session.user.is_anonymous ? 'Field Volunteer' : 'Priya Sharma'),
            role: 'donor',
            avatarInitials: session.user.is_anonymous ? 'FV' : 'PS',
            location: 'Pune',
            createdAt: session.user.created_at,
          })
        }
      } catch (err: any) {
        console.error('Anonymous sign-in error:', err?.message)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? 'anonymous@relieflink.org',
          name: session.user.user_metadata?.full_name ?? (session.user.is_anonymous ? 'Field Volunteer' : 'Priya Sharma'),
          role: 'donor',
          avatarInitials: session.user.is_anonymous ? 'FV' : 'PS',
          location: 'Pune',
          createdAt: session.user.created_at,
        })
      } else {
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? email,
          name: data.user.user_metadata?.full_name ?? email.split('@')[0],
          role: 'donor',
          avatarInitials: (data.user.user_metadata?.full_name ?? email).slice(0, 2).toUpperCase(),
          location: 'Pune',
          createdAt: data.user.created_at,
        })
      }
    } catch (err: any) {
      setError(err?.message || 'Sign in failed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
      signIn: async () => {},
      signOut: async () => {},
    }
  }
  return context
}
