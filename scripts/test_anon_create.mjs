import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://diogvbomcoaotobyvyhi.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpb2d2Ym9tY29hb3RvYnl2eWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzUwOTUsImV4cCI6MjEwNzY1MTA5NX0.vpDM0VxefEH1v6vHSrHqnETYnDRrBwLuJAJTDKUiTsk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
})

async function test() {
  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously()
  console.log('Anon user:', authData.user?.id)

  // Check if profile exists for this new anon user
  const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle()
  console.log('Profile for anon user:', { profile, profErr })

  // Try insert into requests
  const { data: req, error: reqErr } = await supabase.from('requests').insert([{
    requester_id: authData.user.id,
    title: 'Anon test request',
    urgency: 'high',
    status: 'open',
    city: 'Pune',
    address_line: 'Kothrud, Pune'
  }]).select('id').single()

  console.log('Request insert result:', { req, reqErr })
}

test().catch(console.error)
