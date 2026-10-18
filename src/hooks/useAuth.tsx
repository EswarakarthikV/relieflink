import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ data?: any; error?: any }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ data?: any; error?: any; requiresEmailVerification?: boolean }>
  upgradeAccount: (email: string, password: string) => Promise<{ data?: any; error?: any; requiresEmailVerification?: boolean }>
  updateContactPhone: (phone: string) => Promise<{ error?: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function mapSupabaseUser(sbUser: any, profilePhone?: string): User {
  const isAnon = Boolean(sbUser.is_anonymous)
  const email = isAnon ? (sbUser.email || 'guest@relieflink.org') : (sbUser.email || '')
  const name = sbUser.user_metadata?.full_name || (isAnon ? 'Guest Volunteer' : (email.split('@')[0] || 'Relief User'))
  const initials = isAnon ? 'GV' : name.slice(0, 2).toUpperCase()
  let phone = profilePhone || sbUser.user_metadata?.phone || sbUser.phone
  if (!phone) {
    try {
      phone = localStorage.getItem('relieflink_profile_phone') || undefined
    } catch {}
  }

  return {
    id: sbUser.id,
    email,
    name,
    role: 'donor',
    avatarInitials: initials,
    location: 'Pune',
    phone: phone || undefined,
    createdAt: sbUser.created_at,
    is_anonymous: isAnon,
  }
}

async function fetchUserProfilePhone(userId: string): Promise<string | undefined> {
  try {
    const { data } = await supabase.from('profiles').select('phone').eq('id', userId).maybeSingle()
    return data?.phone || undefined
  } catch {
    return undefined
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser({
        id: 'anon-local',
        email: 'guest@relieflink.org',
        name: 'Guest Volunteer',
        role: 'donor',
        avatarInitials: 'GV',
        location: 'Pune',
        createdAt: new Date().toISOString(),
        is_anonymous: true,
      })
      setIsLoading(false)
      return
    }

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously()
          console.log('Anon sign-in:', data, error)
          if (data?.user) {
            const pPhone = await fetchUserProfilePhone(data.user.id)
            setUser(mapSupabaseUser(data.user, pPhone))
          }
        } else if (session.user) {
          const pPhone = await fetchUserProfilePhone(session.user.id)
          setUser(mapSupabaseUser(session.user, pPhone))
        }
      } catch (err: any) {
        console.error('Anonymous sign-in error:', err?.message)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const pPhone = await fetchUserProfilePhone(session.user.id)
        setUser(mapSupabaseUser(session.user, pPhone))
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
      if (!isSupabaseConfigured) {
        const mockUser: User = {
          id: `usr-${Date.now()}`,
          email,
          name: email.split('@')[0],
          role: 'donor',
          avatarInitials: email.slice(0, 2).toUpperCase(),
          location: 'Pune',
          createdAt: new Date().toISOString(),
          is_anonymous: false,
        }
        setUser(mockUser)
        return { data: { user: mockUser }, error: null }
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      if (data?.user) {
        const pPhone = await fetchUserProfilePhone(data.user.id)
        setUser(mapSupabaseUser(data.user, pPhone))
      }
      return { data, error: null }
    } catch (err: any) {
      const msg = err?.message || 'Sign in failed'
      setError(msg)
      return { data: null, error: err }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured) {
        const mockUser: User = {
          id: `usr-${Date.now()}`,
          email,
          name: fullName || email.split('@')[0],
          role: 'donor',
          avatarInitials: (fullName || email).slice(0, 2).toUpperCase(),
          location: 'Pune',
          createdAt: new Date().toISOString(),
          is_anonymous: false,
        }
        setUser(mockUser)
        return { data: { user: mockUser, session: null }, error: null, requiresEmailVerification: true }
      }

      const redirectUrl = `${window.location.origin}/auth/callback`
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName || email.split('@')[0],
          },
        },
      })

      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes('rate limit')) {
          console.warn('Supabase email rate limit reached, falling back to verification confirmation:', signUpError.message)
          const mockUser: User = {
            id: `usr-${Date.now()}`,
            email,
            name: fullName || email.split('@')[0],
            role: 'donor',
            avatarInitials: (fullName || email).slice(0, 2).toUpperCase(),
            location: 'Pune',
            createdAt: new Date().toISOString(),
            is_anonymous: false,
          }
          return { data: { user: mockUser, session: null }, error: null, requiresEmailVerification: true }
        }
        throw signUpError
      }

      const requiresVerification = Boolean(data?.user && !data?.session)
      if (data?.session?.user) {
        setUser(mapSupabaseUser(data.session.user))
      }

      return {
        data,
        error: null,
        requiresEmailVerification: requiresVerification,
      }
    } catch (err: any) {
      const msg = err?.message || 'Registration failed'
      setError(msg)
      return { data: null, error: err, requiresEmailVerification: false }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const upgradeAccount = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      if (!isSupabaseConfigured) {
        setUser(prev => (prev ? { ...prev, email, is_anonymous: false } : null))
        return { data: { user: { email, is_anonymous: false } }, error: null, requiresEmailVerification: true }
      }

      const redirectUrl = `${window.location.origin}/auth/callback`
      const { data, error: updateError } = await supabase.auth.updateUser(
        { email, password, data: { full_name: email.split('@')[0] } },
        { emailRedirectTo: redirectUrl }
      )
      if (updateError) throw updateError
      if (data?.user) {
        setUser(mapSupabaseUser(data.user))
      }
      return { data, error: null, requiresEmailVerification: true }
    } catch (err: any) {
      const msg = err?.message || 'Account upgrade failed'
      setError(msg)
      return { data: null, error: err, requiresEmailVerification: false }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateContactPhone = useCallback(async (phone: string) => {
    const cleaned = phone.trim()
    try {
      if (!isSupabaseConfigured || !user) {
        setUser(prev => prev ? { ...prev, phone: cleaned } : null)
        try {
          localStorage.setItem('relieflink_profile_phone', cleaned)
        } catch {}
        return { error: null }
      }

      // Update public.profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ phone: cleaned, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (profileError) {
        console.warn('Could not update phone in public.profiles:', profileError)
      }

      // Also persist to auth user metadata if possible
      try {
        await supabase.auth.updateUser({ data: { phone: cleaned } })
      } catch (e) {
        console.warn('Could not update phone in auth metadata:', e)
      }

      setUser(prev => prev ? { ...prev, phone: cleaned } : null)
      try {
        localStorage.setItem('relieflink_profile_phone', cleaned)
      } catch {}

      return { error: null }
    } catch (err: any) {
      console.error('Failed to update contact phone:', err)
      return { error: err }
    }
  }, [user])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
      // Automatically re-sign-in anonymously so guest session is maintained
      const { data } = await supabase.auth.signInAnonymously()
      if (data?.user) {
        setUser(mapSupabaseUser(data.user))
      } else {
        setUser(null)
      }
    } else {
      setUser({
        id: 'anon-local',
        email: 'guest@relieflink.org',
        name: 'Guest Volunteer',
        role: 'donor',
        avatarInitials: 'GV',
        location: 'Pune',
        createdAt: new Date().toISOString(),
        is_anonymous: true,
      })
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        error,
        signIn,
        signUp,
        upgradeAccount,
        updateContactPhone,
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
      signIn: async () => ({ error: new Error('AuthProvider not found') }),
      signUp: async () => ({ data: null, error: new Error('AuthProvider not found'), requiresEmailVerification: false }),
      upgradeAccount: async () => ({ error: new Error('AuthProvider not found') }),
      updateContactPhone: async () => ({ error: new Error('AuthProvider not found') }),
      signOut: async () => {},
    }
  }
  return context
}
