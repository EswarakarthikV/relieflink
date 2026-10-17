/**
 * Automated End-to-End Test Suite for ReliefLink Push Notification Dispatcher
 * 
 * Verifies:
 * 1. OPTIONS CORS headers on /api/notify
 * 2. ANTI-ABUSE: Unauthenticated broadcast attempt returns HTTP 403 Forbidden
 * 3. ANTI-ABUSE: Unauthenticated database webhook attempt returns HTTP 401 Unauthorized
 * 4. ANTI-ABUSE: Unauthenticated direct user push returns HTTP 401 Unauthorized
 * 5. Authorized Direct Event Dispatching with server secret (/api/notify)
 * 6. Idempotency deduplication (identical keys return duplicate: true)
 * 7. Authorized Supabase DB Webhook payload handling (table: 'notifications')
 * 8. Authorized Supabase DB Webhook critical request broadcast (table: 'requests')
 * 9. Non-critical request filtering (low urgency requests do not blast push alerts)
 * 10. Missing VAPID credentials graceful handling
 * 11. Fault-isolated mock subscription delivery
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { processNotifyRequest } from '../netlify/functions/notify.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
    }
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const BASE_URL = 'http://localhost:4174'
const WEBHOOK_SECRET = env.WEBHOOK_SECRET || '1c24fe4d233932b9bda13f385c37f7fd737b9194c1657dd1976386b13ba5fdd9'

let testsPassed = 0
let testsFailed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    testsPassed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    testsFailed++
  }
}

async function run() {
  console.log('===========================================================')
  console.log(' ReliefLink Automatic Push Notification Security & E2E     ')
  console.log('===========================================================')

  // TEST 1: OPTIONS CORS Preflight Check on /api/notify
  console.log('\n[1] Testing OPTIONS CORS Preflight on /api/notify...')
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, { method: 'OPTIONS' })
    assert(res.status === 204, 'OPTIONS response returns HTTP 204 No Content')
    assert(res.headers.get('access-control-allow-origin') === '*', 'CORS Allow-Origin header present')
    assert(res.headers.get('access-control-allow-methods')?.includes('POST'), 'CORS Allow-Methods includes POST')
  } catch (err) {
    assert(false, `OPTIONS preflight failed: ${err.message}`)
  }

  // TEST 2: ANTI-ABUSE: Unauthenticated Broadcast Rejection
  console.log('\n[2] Testing Anti-Abuse: Unauthenticated Broadcast Rejection...')
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'broadcast',
        recipientUserId: null, // Broadcast attempt without credentials
        title: 'Spam broadcast test',
        body: 'This should be blocked',
      }),
    })
    const data = await res.json()
    assert(res.status === 403, `Unauthenticated broadcast returned HTTP 403 Forbidden (Got ${res.status})`)
    assert(data.error === 'BROADCAST_FORBIDDEN', 'Error code is BROADCAST_FORBIDDEN')
  } catch (err) {
    assert(false, `Broadcast rejection test failed: ${err.message}`)
  }

  // TEST 3: ANTI-ABUSE: Unauthenticated Database Webhook Rejection
  console.log('\n[3] Testing Anti-Abuse: Unauthenticated Webhook Rejection...')
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'INSERT',
        table: 'notifications',
        record: {
          id: 99999,
          user_id: 'fake-user',
          title: 'Spoofed Notification',
        },
      }),
    })
    const data = await res.json()
    assert(res.status === 401, `Unauthenticated webhook returned HTTP 401 Unauthorized (Got ${res.status})`)
    assert(data.error === 'UNAUTHORIZED_WEBHOOK', 'Error code is UNAUTHORIZED_WEBHOOK')
  } catch (err) {
    assert(false, `Webhook rejection test failed: ${err.message}`)
  }

  // TEST 4: ANTI-ABUSE: Unauthenticated Direct Push Rejection
  console.log('\n[4] Testing Anti-Abuse: Unauthenticated Direct Push Rejection...')
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'offer_created',
        recipientUserId: 'target-user-123',
        title: 'Spam Direct Message',
        body: 'Unauthenticated push attempt',
      }),
    })
    const data = await res.json()
    assert(res.status === 401, `Unauthenticated direct push returned HTTP 401 Unauthorized (Got ${res.status})`)
    assert(data.error === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED')
  } catch (err) {
    assert(false, `Direct push rejection test failed: ${err.message}`)
  }

  // TEST 5: Authorized Direct Event Dispatch via HTTP (with Server Secret)
  console.log('\n[5] Testing Authorized Direct Event Dispatch with Server Secret...')
  const testIdempotencyKey = `e2e-direct-${Date.now()}`
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        event: 'offer_created',
        recipientUserId: 'test-user-001',
        title: 'New Offer Received (Authorized E2E Test)',
        body: 'A volunteer offered 50 boxes of clean water.',
        url: '/requests/test-req-123',
        tag: 'relieflink-e2e',
        idempotencyKey: testIdempotencyKey,
      }),
    })
    const data = await res.json()
    assert(res.status === 200, `Authorized POST returned HTTP 200 (Got ${res.status})`)
    assert(data.success === true, 'Response contains success: true')
    assert(data.duplicate !== true, 'Initial request is recognized as new (not duplicate)')
  } catch (err) {
    assert(false, `Authorized event dispatch failed: ${err.message}`)
  }

  // TEST 6: Idempotency Verification (duplicate delivery suppression)
  console.log('\n[6] Testing Idempotency (prevent duplicate pushes on retry)...')
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        event: 'offer_created',
        recipientUserId: 'test-user-001',
        title: 'New Offer Received (Authorized E2E Test)',
        body: 'A volunteer offered 50 boxes of clean water.',
        url: '/requests/test-req-123',
        tag: 'relieflink-e2e',
        idempotencyKey: testIdempotencyKey, // EXACT SAME KEY
      }),
    })
    const data = await res.json()
    assert(res.status === 200, 'Duplicate request returned HTTP 200')
    assert(data.success === true, 'Duplicate response returns success: true')
    assert(data.duplicate === true, 'Correctly detected as duplicate (duplicate: true)')
    assert(data.message?.includes('idempotent duplicate ignored'), 'Informative message returned for duplicate')
  } catch (err) {
    assert(false, `Idempotency check failed: ${err.message}`)
  }

  // TEST 7: Authorized Supabase Database Webhook Mode (table: 'notifications')
  console.log('\n[7] Testing Authorized Supabase DB Webhook on table: notifications...')
  const dbNotifId = Math.floor(Math.random() * 1000000)
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        type: 'INSERT',
        table: 'notifications',
        schema: 'public',
        record: {
          id: dbNotifId,
          user_id: 'db-user-999',
          title: 'Offer Dispatched Alert',
          body: 'Consignment MH-12-AB has been dispatched.',
          link: '/requests/req-789',
          kind: 'offer',
        },
      }),
    })
    const data = await res.json()
    assert(res.status === 200, 'Authorized webhook response returned HTTP 200')
    assert(data.success === true, 'Webhook parsed and executed successfully')
  } catch (err) {
    assert(false, `DB Webhook test failed: ${err.message}`)
  }

  // TEST 8: Authorized Supabase Database Webhook on critical request broadcast
  console.log('\n[8] Testing Authorized Supabase DB Webhook on critical request broadcast...')
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        type: 'INSERT',
        table: 'requests',
        schema: 'public',
        record: {
          id: 'crisis-req-' + Date.now(),
          urgency: 'critical',
          city: 'Coimbatore Flood Center',
          title: 'Emergency Medical Kit Required',
        },
      }),
    })
    const data = await res.json()
    assert(res.status === 200, 'Critical request webhook returned HTTP 200')
    assert(data.success === true, 'Critical request broadcast triggered')
  } catch (err) {
    assert(false, `Critical request webhook test failed: ${err.message}`)
  }

  // TEST 9: Non-critical request filtering (No blanket push)
  console.log('\n[9] Testing Non-critical request filtering...')
  try {
    const res = await fetch(`${BASE_URL}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        type: 'INSERT',
        table: 'requests',
        schema: 'public',
        record: {
          id: 'low-req-' + Date.now(),
          urgency: 'low',
          city: 'Pune',
          title: 'Extra books requested',
        },
      }),
    })
    const data = await res.json()
    assert(res.status === 200, 'Non-critical webhook returned HTTP 200')
    assert(data.delivered === 0, 'Zero pushes delivered for non-critical request')
    assert(data.message?.includes('ignored for broadcast'), 'Properly marked as ignored for broadcast')
  } catch (err) {
    assert(false, `Non-critical filtering test failed: ${err.message}`)
  }

  // TEST 10: Missing VAPID keys safety
  console.log('\n[10] Testing missing VAPID keys safety...')
  try {
    const result = await processNotifyRequest(
      { event: 'test', recipientUserId: 'user-1', title: 'Test', body: 'Test' },
      { ...env, VAPID_PRIVATE_KEY: '' }, // deliberately cleared
      undefined,
      { webhookSecret: WEBHOOK_SECRET }
    )
    assert(result.success === false, 'Returns success: false when VAPID keys are missing')
    assert(result.error === 'VAPID_KEYS_NOT_CONFIGURED', 'Returns VAPID_KEYS_NOT_CONFIGURED code')
  } catch (err) {
    assert(false, `Missing VAPID test threw unexpected error: ${err.message}`)
  }

  // TEST 11: Mock subscription dispatching & fault isolation
  console.log('\n[11] Testing Mock subscription dispatching & fault isolation...')
  try {
    const mockSubs = [
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fake-test-endpoint-expired',
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcUbVYOIx0-HeNUmTbh7aoNzCT-2IvjM4U1rM13yE3XWk',
        auth: 'tBHItDaA7mFq27_r2s9lQg',
        user_id: 'mock-user-123'
      }
    ]
    const result = await processNotifyRequest(
      { event: 'direct', recipientUserId: 'mock-user-123', title: 'Test Isolated', body: 'Test Body', idempotencyKey: `mock-${Date.now()}` },
      env,
      mockSubs,
      { webhookSecret: WEBHOOK_SECRET }
    )
    assert(result.success === true, 'Dispatched to mock subscription successfully without crashing')
    assert(result.total === 1, 'Total subscriptions counted as 1')
    assert(result.details?.length === 1, 'Details array contains dispatch result')
  } catch (err) {
    assert(false, `Mock subscription test failed: ${err.message}`)
  }

  console.log('\n===========================================================')
  console.log(` Security & E2E Summary: ${testsPassed} passed, ${testsFailed} failed`)
  console.log('===========================================================')

  if (testsFailed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
