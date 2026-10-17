import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if ((!supabaseUrl || !supabaseAnonKey) && fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = trimmed.substring('VITE_SUPABASE_URL='.length).trim()
    } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = trimmed.substring('VITE_SUPABASE_ANON_KEY='.length).trim()
    }
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Supabase configuration missing in environment or .env.local')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
})

async function test() {
  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously()
  if (authErr) {
    console.log('Anon auth error:', authErr)
    return
  }
  console.log('Anon user created:', Boolean(authData.user?.id))

  // Check if profile exists for this new anon user
  const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle()
  console.log('Profile query result:', { hasProfile: Boolean(profile), profErr })

  // Try insert into requests
  const { data: req, error: reqErr } = await supabase.from('requests').insert([{
    requester_id: authData.user.id,
    title: 'Anon test request',
    urgency: 'high',
    status: 'open',
    city: 'Pune',
    address_line: 'Kothrud, Pune'
  }]).select('id').single()

  console.log('Request insert result:', { hasReq: Boolean(req?.id), reqErr })
}

test().catch(console.error)
