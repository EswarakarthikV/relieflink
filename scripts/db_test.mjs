import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://diogvbomcoaotobyvyhi.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpb2d2Ym9tY29hb3RvYnl2eWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzUwOTUsImV4cCI6MjEwNzY1MTA5NX0.vpDM0VxefEH1v6vHSrHqnETYnDRrBwLuJAJTDKUiTsk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function run() {
  console.log('Testing Supabase connection...')
  const { data: requests, error: reqErr } = await supabase.from('requests').select('id, title, status, location').limit(5)
  console.log('Requests query result:', reqErr || requests)

  const { data: items, error: itemErr } = await supabase.from('request_items').select('*').limit(5)
  console.log('Request items query result:', itemErr || items)

  const { data: stats, error: statsErr } = await supabase.from('request_item_stats').select('*').limit(5)
  console.log('Request item stats result:', statsErr || stats)

  const { data: contacts, error: contactErr } = await supabase.from('request_contacts').select('*').limit(5)
  console.log('Request contacts query result:', contactErr || contacts)
}

run().catch(console.error)
