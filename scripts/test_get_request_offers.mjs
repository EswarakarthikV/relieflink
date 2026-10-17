import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://diogvbomcoaotobyvyhi.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpb2d2Ym9tY29hb3RvYnl2eWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzUwOTUsImV4cCI6MjEwNzY1MTA5NX0.vpDM0VxefEH1v6vHSrHqnETYnDRrBwLuJAJTDKUiTsk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  const { data: requests } = await supabase.from('requests').select('id, title').limit(5)
  console.log('Available requests in DB:', requests)

  if (requests && requests.length > 0) {
    for (const r of requests) {
      const { data: offers, error } = await supabase.rpc('get_request_offers', {
        p_request_id: r.id
      })
      console.log(`Offers for request ${r.id} (${r.title}):`, { error, offersCount: offers?.length, offers })
    }
  }

  // Also test with a non-uuid like 'req-001'
  const { data: mockOffers, error: mockError } = await supabase.rpc('get_request_offers', {
    p_request_id: '1f0b895f-5302-4ac2-8931-197766024e32'
  })
  console.log('Test for 1f0b895f-5302-4ac2-8931-197766024e32:', { mockError, mockOffers })
}

test().catch(console.error)
