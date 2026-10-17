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

async function run() {
  console.log('Testing Supabase connection...')
  const { data: requests, error: reqErr } = await supabase.from('requests').select('id, title, status').limit(5)
  console.log('Requests query result:', reqErr || requests)

  const { data: items, error: itemErr } = await supabase.from('request_items').select('*').limit(5)
  console.log('Request items query result:', itemErr || items)

  const { data: stats, error: statsErr } = await supabase.from('request_item_stats').select('*').limit(5)
  console.log('Request item stats result:', statsErr || stats)

  const { data: contacts, error: contactErr } = await supabase.from('request_contacts').select('*').limit(5)
  console.log('Request contacts query result:', contactErr || contacts)
}

run().catch(console.error)
