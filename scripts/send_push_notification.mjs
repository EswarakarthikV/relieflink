import webpush from 'web-push'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local
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
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      env[key] = val
    }
  }
  return env
}

const env = loadEnv()
const vapidPublicKey = env.VITE_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
const vapidPrivateKey = env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY
const vapidSubject = env.VAPID_SUBJECT || process.env.VAPID_SUBJECT || 'mailto:admin@relieflink.org'

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('[Error] VAPID keys not configured in .env.local')
  process.exit(1)
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

export async function sendWebPush(subscription, payload) {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh || (subscription.keys && subscription.keys.p256dh),
      auth: subscription.auth || (subscription.keys && subscription.keys.auth)
    }
  }

  const notificationPayload = JSON.stringify({
    title: payload.title || 'ReliefLink Alert',
    body: payload.body || 'New humanitarian supply update.',
    url: payload.url || '/alerts',
    tag: payload.tag || 'relieflink-alert',
    timestamp: Date.now()
  })

  try {
    const res = await webpush.sendNotification(pushSubscription, notificationPayload)
    return { success: true, statusCode: res.statusCode }
  } catch (err) {
    return { success: false, error: err.message, statusCode: err.statusCode }
  }
}

// CLI usage: node scripts/send_push_notification.mjs
async function run() {
  console.log('--- ReliefLink Web Push Notification Dispatcher ---')
  console.log('VAPID Public Key:', vapidPublicKey.slice(0, 16) + '...')
  console.log('Subject:', vapidSubject)

  const args = process.argv.slice(2)
  const title = args[0] || 'ReliefLink Urgent Alert'
  const body = args[1] || 'Field Hospital Alpha requested emergency antibiotics (50 boxes).'
  const url = args[2] || '/alerts'

  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.log('No Supabase credentials found to query subscriptions.')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: subs, error } = await supabase.from('push_subscriptions').select('*')

  if (error || !subs || subs.length === 0) {
    console.log('No active push subscriptions found in database or push_subscriptions table not created yet.')
    console.log('Note: To push directly to a specific subscription, pass the subscription object to sendWebPush().')
    return
  }

  console.log(`Found ${subs.length} push subscription(s). Dispatching alert...`)
  for (const sub of subs) {
    const result = await sendWebPush(sub, { title, body, url })
    console.log(`Endpoint: ${sub.endpoint.slice(0, 30)}... Result:`, result)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(console.error)
}
