/**
 * Server-side Netlify Serverless Function for Web Push Notifications
 * 
 * Provides automated, reliable remote push notification delivery for ReliefLink:
 * - Netlify Functions v2 path binding: config.path = "/api/notify"
 * - Dual integration: Supabase Database Webhooks + Direct application events
 * - Anti-Abuse Protection: Broadcast pushes strictly restricted to verified server webhooks
 * - Caller Authentication: Supabase Bearer token verification for targeted user events
 * - Automatic subscription querying & targeting (single user or broadcast)
 * - Expired subscription pruning (HTTP 410 Gone / 404 Not Found)
 * - Idempotency deduplication cache (5-minute sliding window prevents duplicate pushes)
 * - Fault-isolated delivery (failure to reach one device does not fail others)
 * - In-memory rate limiting and provider error masking
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const config = {
  path: '/api/notify',
}

interface WebhookRecord {
  id?: string | number
  user_id?: string
  title?: string
  body?: string
  link?: string
  kind?: string
  urgency?: string
  city?: string
  description?: string
  status?: string
  created_at?: string
  [key: string]: any
}

interface NotifyRequestBody {
  // Direct Event mode
  event?: 'critical_request' | 'offer_created' | 'offer_accepted' | 'offer_dispatched' | 'offer_delivered' | 'offer_rejected' | 'offer_cancelled' | 'test' | 'broadcast' | 'direct'
  recipientUserId?: string | null
  title?: string
  body?: string
  url?: string
  tag?: string
  idempotencyKey?: string

  // Supabase Database Webhook mode
  type?: 'INSERT' | 'UPDATE' | 'DELETE'
  table?: 'notifications' | 'requests' | 'offers' | string
  schema?: string
  record?: WebhookRecord
  old_record?: WebhookRecord | null
}

export interface RequestAuthHeaders {
  authorization?: string | null
  webhookSecret?: string | null
  clientIp?: string | null
}

// In-memory sliding-window IP rate limiter
interface RateLimitEntry {
  count: number
  resetAt: number
}
const rateLimitMap = new Map<string, RateLimitEntry>()

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const maxRequests = 60 // per minute
  const windowMs = 60 * 1000

  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.count++
  return { allowed: true }
}

function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}

// Idempotency cache: prevents duplicate pushes on retries
const processedPushes = new Map<string, number>()
const DEDUP_TTL_MS = 5 * 60 * 1000 // 5 minutes

function checkIdempotency(key: string): boolean {
  const now = Date.now()
  const lastTime = processedPushes.get(key)
  if (lastTime && (now - lastTime) < DEDUP_TTL_MS) {
    return false // Duplicate!
  }
  processedPushes.set(key, now)

  // Prune cache if it grows large
  if (processedPushes.size > 2000) {
    for (const [k, timestamp] of processedPushes.entries()) {
      if (now - timestamp > DEDUP_TTL_MS) {
        processedPushes.delete(k)
      }
    }
  }
  return true // New notification
}

export interface NotifyProcessResult {
  success: boolean
  statusCode?: number
  duplicate?: boolean
  message?: string
  warning?: string
  total?: number
  delivered?: number
  failed?: number
  pruned?: number
  details?: Array<{ endpoint: string; status: 'delivered' | 'failed' | 'pruned'; statusCode?: number; error?: string }>
  error?: string
}

/**
 * Core notification dispatch processor with Anti-Abuse and Webhook Authentication
 */
export async function processNotifyRequest(
  body: NotifyRequestBody,
  customEnv?: Record<string, string | undefined>,
  mockSubscriptions?: Array<{ id?: string; endpoint: string; p256dh: string; auth: string; user_id?: string | null }>,
  headers?: RequestAuthHeaders
): Promise<NotifyProcessResult> {
  const env = customEnv || process.env

  // 1. Resolve secrets
  const vapidPrivateKey = env.VAPID_PRIVATE_KEY
  const vapidPublicKey = env.VITE_VAPID_PUBLIC_KEY || env.VAPID_PUBLIC_KEY
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:admin@relieflink.org'

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

  const webhookSecret = (env.WEBHOOK_SECRET || env.NOTIFY_SECRET || env.SUPABASE_WEBHOOK_SECRET || '').trim()

  // 2. Authentication & Authorization Verification
  const incomingWebhookSecret = (headers?.webhookSecret || '').trim()
  const incomingAuthHeader = (headers?.authorization || '').trim()

  const isServerAuthorized = Boolean(
    webhookSecret &&
    (incomingWebhookSecret === webhookSecret || incomingAuthHeader === `Bearer ${webhookSecret}`)
  )

  let authenticatedUserId: string | null = null
  if (!isServerAuthorized && incomingAuthHeader.startsWith('Bearer ') && supabaseUrl && supabaseKey) {
    const userToken = incomingAuthHeader.slice(7).trim()
    if (userToken && userToken !== webhookSecret) {
      try {
        const supabaseAuth = createClient(supabaseUrl, supabaseKey)
        const { data: { user }, error: userAuthError } = await supabaseAuth.auth.getUser(userToken)
        if (!userAuthError && user?.id) {
          authenticatedUserId = user.id
        }
      } catch {
        // invalid user token
      }
    }
  }

  // A. Check Webhook payloads: Claiming to be a database webhook REQUIRES server webhook secret
  if (body.table && body.record) {
    if (!isServerAuthorized) {
      return {
        success: false,
        statusCode: 401,
        error: 'UNAUTHORIZED_WEBHOOK',
        message: 'Database webhooks require a valid server webhook secret.',
      }
    }
  }

  // 3. Normalize notification data from either Webhook or Direct Event
  let recipientUserId: string | null = null
  let title = 'ReliefLink Alert'
  let bodyText = 'New humanitarian supply update.'
  let url = '/alerts'
  let tag = 'relieflink-alert'
  let dedupKey: string | null = null

  // CASE A: Supabase Database Webhook (Verified Server Authorized)
  if (body.table && body.record) {
    const record = body.record

    if (body.table === 'notifications') {
      recipientUserId = record.user_id || null
      title = record.title || title
      bodyText = record.body || bodyText
      url = record.link || url
      tag = `relieflink-${record.kind || 'alert'}`
      dedupKey = record.id ? `db-notif-${record.id}` : `db-notif-${recipientUserId}-${title}`
    } else if (body.table === 'requests') {
      const urgency = (record.urgency || '').toLowerCase()
      // Broadcast critical and high urgency requests to all subscribers
      if (urgency === 'critical' || urgency === 'high') {
        recipientUserId = null // broadcast to all
        title = urgency === 'critical'
          ? `🚨 Critical Relief Needed: ${record.city || 'Emergency Area'}`
          : `⚠️ Urgent Relief Needed: ${record.city || 'Emergency Area'}`
        bodyText = record.title || 'Urgent supplies needed immediately.'
        url = `/requests/${record.id}`
        tag = `relieflink-request-${record.id}`
        dedupKey = `db-req-${record.id}`
      } else {
        // Non-critical requests do not send blanket push notifications
        return {
          success: true,
          delivered: 0,
          message: 'Non-critical request ignored for broadcast push notification.',
        }
      }
    } else {
      return {
        success: true,
        delivered: 0,
        message: `Webhook table '${body.table}' ignored.`,
      }
    }
  }
  // CASE B: Direct Application Event
  else {
    recipientUserId = body.recipientUserId !== undefined ? body.recipientUserId : null
    title = body.title || title
    bodyText = body.body || bodyText
    url = body.url || url
    tag = body.tag || `relieflink-${body.event || 'alert'}`
    dedupKey = body.idempotencyKey || `${body.event || 'event'}-${recipientUserId || 'broadcast'}-${title}-${bodyText}`

    // B. Anti-Abuse Check: Broadcast pushes (null, 'all', 'broadcast') REQUIRE server authorization
    const isBroadcast = !recipientUserId || recipientUserId === 'all' || recipientUserId === 'broadcast'
    if (isBroadcast) {
      if (!isServerAuthorized) {
        return {
          success: false,
          statusCode: 403,
          error: 'BROADCAST_FORBIDDEN',
          message: 'Broadcast notifications to all subscribers require server authorization.',
        }
      }
    } else {
      // Direct push to specific user: requires server authorization OR authenticated user
      if (!isServerAuthorized && !authenticatedUserId) {
        return {
          success: false,
          statusCode: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required to dispatch notifications.',
        }
      }
    }
  }

  // 4. Idempotency Check
  if (dedupKey) {
    const isNew = checkIdempotency(dedupKey)
    if (!isNew) {
      return {
        success: true,
        duplicate: true,
        delivered: 0,
        message: 'Notification already delivered (idempotent duplicate ignored).',
      }
    }
  }

  // 5. Check VAPID credentials
  if (!vapidPrivateKey || !vapidPublicKey) {
    console.warn('[Notify Service] VAPID keys missing. Push notification delivery skipped.')
    return {
      success: false,
      statusCode: 503,
      error: 'VAPID_KEYS_NOT_CONFIGURED',
      message: 'VAPID public and/or private keys not configured on server.',
    }
  }

  let subs = mockSubscriptions || null

  // 6. Connect to Supabase to fetch active subscriptions if not mocked
  if (!subs) {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Notify Service] Supabase credentials not found.')
      return {
        success: false,
        statusCode: 503,
        error: 'SUPABASE_NOT_CONFIGURED',
        message: 'Supabase credentials not configured to query subscriptions.',
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Target query: specific user or all subscriptions (broadcast)
    let query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id')
    if (recipientUserId && recipientUserId !== 'all' && recipientUserId !== 'broadcast') {
      query = query.eq('user_id', recipientUserId)
    }

    const { data: dbSubs, error: queryError } = await query

    if (queryError) {
      // If the push_subscriptions table has not yet been migrated in Supabase
      if (queryError.code === 'PGRST205' || queryError.code === '42P01' || queryError.message?.includes('push_subscriptions')) {
        console.warn('[Notify Service] push_subscriptions table not created yet in Supabase.')
        return {
          success: true,
          total: 0,
          delivered: 0,
          failed: 0,
          pruned: 0,
          warning: 'push_subscriptions table not found in Supabase. Please apply 006_push_subscriptions.sql migration.',
          message: 'Notification processed, but no subscription table exists in database.',
        }
      }
      console.error('[Notify Service] Error querying subscriptions:', queryError.message)
      return {
        success: false,
        statusCode: 500,
        error: queryError.message,
        message: 'Failed to query push_subscriptions table.',
      }
    }

    subs = dbSubs
  }

  if (!subs || subs.length === 0) {
    return {
      success: true,
      total: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      message: recipientUserId
        ? `No active subscriptions registered for user ${recipientUserId}.`
        : 'No active push subscriptions registered.',
    }
  }

  // 7. Configure WebPush
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const payloadString = JSON.stringify({
    title,
    body: bodyText,
    url,
    tag,
    timestamp: Date.now(),
  })

  let deliveredCount = 0
  let failedCount = 0
  let prunedCount = 0
  const details: Array<{ endpoint: string; status: 'delivered' | 'failed' | 'pruned'; statusCode?: number; error?: string }> = []

  // 8. Dispatch concurrently with isolated error handling & 410/404 pruning
  const dispatchPromises = subs.map(async (sub) => {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    }

    try {
      const res = await webpush.sendNotification(pushSub, payloadString)
      deliveredCount++
      details.push({
        endpoint: sub.endpoint.slice(0, 30) + '...',
        status: 'delivered',
        statusCode: res.statusCode,
      })
    } catch (err: any) {
      const statusCode = err?.statusCode
      // Expired or invalid subscription: 410 Gone or 404 Not Found
      if (statusCode === 410 || statusCode === 404) {
        prunedCount++
        details.push({
          endpoint: sub.endpoint.slice(0, 30) + '...',
          status: 'pruned',
          statusCode,
        })
        try {
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey)
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        } catch (delErr) {
          console.warn('[Notify Service] Failed to prune subscription:', delErr)
        }
      } else {
        failedCount++
        details.push({
          endpoint: sub.endpoint.slice(0, 30) + '...',
          status: 'failed',
          statusCode,
          error: err?.message || 'Send error',
        })
      }
    }
  })

  await Promise.all(dispatchPromises)

  return {
    success: true,
    total: subs.length,
    delivered: deliveredCount,
    failed: failedCount,
    pruned: prunedCount,
    details,
  }
}

/**
 * Netlify Functions v2 default handler
 */
export default async function (request: Request): Promise<Response> {
  cleanupRateLimits()

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-secret',
      },
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate Limiting check
  const clientIp = request.headers.get('client-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1'
  const rate = checkRateLimit(clientIp)
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rate.retryAfter || 60),
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }

  const authHeaders: RequestAuthHeaders = {
    authorization: request.headers.get('authorization'),
    webhookSecret: request.headers.get('x-webhook-secret'),
    clientIp,
  }

  try {
    const body = await request.json()
    const result = await processNotifyRequest(body, process.env, undefined, authHeaders)
    const status = result.statusCode || (result.success ? 200 : 400)

    return new Response(JSON.stringify(result), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: any) {
    console.error('[Server Notify Error]:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to process notification request.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}

/**
 * Netlify Functions v1 handler (backward compatibility)
 */
export const handler = async (event: any) => {
  cleanupRateLimits()

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-secret',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const clientIp = event.headers?.['client-ip'] || event.headers?.['x-forwarded-for'] || '127.0.0.1'
  const rate = checkRateLimit(clientIp)
  if (!rate.allowed) {
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rate.retryAfter || 60),
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }),
    }
  }

  const authHeaders: RequestAuthHeaders = {
    authorization: event.headers?.['authorization'] || event.headers?.['Authorization'],
    webhookSecret: event.headers?.['x-webhook-secret'] || event.headers?.['X-Webhook-Secret'],
    clientIp,
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    const result = await processNotifyRequest(body, process.env, undefined, authHeaders)
    const status = result.statusCode || (result.success ? 200 : 400)
    return {
      statusCode: status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    }
  } catch (err: any) {
    console.error('[Server Notify Error]:', err)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to process notification request.' }),
    }
  }
}
