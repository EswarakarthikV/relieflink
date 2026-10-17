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

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data: requests } = await supabase.from('requests').select('id, title').limit(5)
  console.log('Available requests in DB count:', requests?.length)

  if (requests && requests.length > 0) {
    for (const r of requests.slice(0, 2)) {
      const { data: offers, error } = await supabase.rpc('get_request_offers', {
        p_request_id: r.id
      })
      console.log(`Offers check for request ${r.id}:`, { error, offersCount: offers?.length })
    }
  }
}

test().catch(console.error)
