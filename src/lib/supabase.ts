/**
 * Supabase client placeholder.
 * Populate VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 * then uncomment the real client below.
 */

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// ── Stub so the app boots without credentials ─────────────────────────────
const supabaseStub = {
  auth: {
    signInWithPassword: async (_: { email: string; password: string }) => ({
      data: null,
      error: new Error('Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'),
    }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: (_table: string) => ({
    select: () => ({ data: [], error: null }),
  }),
}

if (SUPABASE_URL && SUPABASE_ANON) {
  // Uncomment when @supabase/supabase-js is installed:
  // import { createClient } from '@supabase/supabase-js'
  // export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  console.info('[supabase] env vars found — wire up @supabase/supabase-js when ready')
}

export const supabase = supabaseStub
