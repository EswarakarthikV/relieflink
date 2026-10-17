/**
 * Server-side Netlify Serverless Function for AI Operations
 * 
 * Securely calls Sarvam AI (with Google Gemini fallback) without exposing private
 * API keys to client-side bundles or browser environments.
 * 
 * Security features:
 * - Netlify Functions v2 path binding: config.path = "/api/ai"
 * - In-memory IP-based rate limiting (sliding window)
 * - Strict action whitelisting & input payload length validation
 * - Header-based API key transport (no secrets in query params or URLs)
 * - Provider error masking (no upstream keys, URLs, or internal errors exposed to clients)
 */

export const config = {
  path: '/api/ai',
}

interface AIRequestBody {
  action: 'normalize-search' | 'enhance-title' | 'enhance-description' | 'match-item'
  queryText?: string
  rawTitle?: string
  rawDescription?: string
  title?: string
  description?: string
  category?: string
  donorItem?: string
  requestedItem?: string
}

const ALLOWED_ACTIONS = new Set([
  'normalize-search',
  'enhance-title',
  'enhance-description',
  'match-item',
])

// In-memory sliding-window IP rate limiter
interface RateLimitEntry {
  count: number
  resetAt: number
}
const rateLimitMap = new Map<string, RateLimitEntry>()

function checkRateLimit(ip: string, action: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const key = `${ip}:${action}`
  const maxRequests = action === 'normalize-search' ? 40 : 20 // per minute
  const windowMs = 60 * 1000

  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.count += 1
  return { allowed: true }
}

// Clean up expired rate limit entries periodically (every 5 minutes)
let lastCleanup = Date.now()
function cleanupRateLimits() {
  const now = Date.now()
  if (now - lastCleanup > 300000) {
    lastCleanup = now
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }
}

const SYSTEM_PROMPT = `You are a disaster relief assistant that rewrites requests into clear, professional English. Output ONLY valid JSON.

CRITICAL RULES — never violate:
1. NEVER invent quantities, units, numbers, or measurements that are not explicitly in the input. If the input says '100 people', do NOT add '100 liters'. If the input has no quantity for the supply, do NOT add one.
2. Distinguish between:
   - The number of PEOPLE affected (e.g., '100 families')
   - The QUANTITY of supplies needed (e.g., '200 bottles')
   - The DURATION of a situation (e.g., 'without water for a week')
   Never swap one for another.
3. If input says 'X for Y days', preserve both X and Y exactly. If input says 'without X for Y days', preserve the past-tense meaning — do NOT convert it to 'need X for Y days'.
4. Preserve units exactly as written (bottles, liters, kg, kits, packets, families, people). Do NOT change 'bottles' to 'liters'.
5. If a fact is not in the input, omit it. Better to be brief than to invent.`

async function callSarvam(
  prompt: string,
  apiKey: string,
  systemPrompt?: string,
  jsonMode = true,
): Promise<string> {
  const models = ['sarvam-105b-conversations', 'sarvam-105b', 'sarvam-m']
  let lastError: any = new Error('Sarvam API call failed')

  for (const model of models) {
    const body: Record<string, any> = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt || SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    }

    if (jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    try {
      const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        lastError = new Error(`Sarvam ${res.status}: ${text}`)
        if (res.status === 400 && text.includes('deprecated')) {
          continue
        }
        throw lastError
      }

      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (content) return content
    } catch (err) {
      lastError = err
    }
  }

  throw lastError
}

async function callGemini(
  prompt: string,
  apiKey: string,
  jsonMode = true,
): Promise<string> {
  // Use header-based authentication so the API key never appears in the URL or query string
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    },
  )

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${errorText}`)
  }

  const data = await res.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('Empty response from Gemini API')
  return content
}

async function callAI(
  prompt: string,
  env: Record<string, string | undefined>,
  systemPrompt?: string,
  jsonMode = true,
): Promise<string> {
  const sarvamKey = (env.SARVAM_API_KEY || env.VITE_SARVAM_API_KEY || '').trim()
  const geminiKey = (env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '').trim()

  if (sarvamKey) {
    try {
      return await callSarvam(prompt, sarvamKey, systemPrompt, jsonMode)
    } catch (err) {
      console.warn('[Server AI] Sarvam attempt failed, trying Gemini fallback:', err)
      if (!geminiKey) throw err
    }
  }

  if (geminiKey) {
    return await callGemini(prompt, geminiKey, jsonMode)
  }

  throw new Error('NO_AI_KEY_CONFIGURED')
}

function cleanJSON<T>(raw: string, fallback: T): T {
  try {
    let cleaned = raw.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim()
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1)
    }
    return JSON.parse(cleaned)
  } catch {
    return fallback
  }
}

export async function processAIRequest(body: AIRequestBody, env: Record<string, string | undefined> = process.env) {
  const { action } = body

  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`INVALID_ACTION: Unknown action "${action}"`)
  }

  if (action === 'normalize-search') {
    const query = (body.queryText || '').trim()
    if (!query || query.length <= 2) {
      return { normalized: query }
    }
    if (query.length > 200) {
      throw new Error('INPUT_TOO_LONG: Search query exceeds 200 characters limit.')
    }

    const prompt = `You are a search normalizer for an Indian disaster relief app. 
Translate the following local language or Tanglish/Hinglish term into the standard English supply name. 
Examples: paani/pani/thanni/neer/tanni -> water, khana/unavu/saapadu -> food, chawal/arisi -> rice, kapde/thuni -> cloth, kambal/kambili/kambuli/bedsheet -> blanket, dawai/marundhu -> medicine.
If the input is already standard English, return it as is.
Return ONLY the single English word, nothing else. No explanations.

User input: ${query}`

    const raw = await callAI(
      prompt,
      env,
      'You are a search normalizer. Return ONLY the single English word, nothing else. No explanations.',
      false,
    )

    const cleaned = raw
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/[".`,]/g, '')
      .trim()
      .toLowerCase()

    const normalized = cleaned.split(/\s+/)[0] || query.toLowerCase()
    return { normalized }
  }

  if (action === 'enhance-title') {
    const rawTitle = (body.rawTitle || '').trim()
    const description = (body.description || '').trim()
    const category = (body.category || 'General').trim()

    if (rawTitle.length > 300) {
      throw new Error('INPUT_TOO_LONG: Title input exceeds 300 characters limit.')
    }
    if (description.length > 3000) {
      throw new Error('INPUT_TOO_LONG: Description exceeds 3000 characters limit.')
    }

    const prompt = `Rewrite this disaster relief request title to be clear and specific.

The input may contain:
- Typos and abbreviations (e.g., 'mmbrs' = members, 'fr' = for, 'pls' = please, 'tnk' = tank, 'asap' = urgently)
- Mixed Tamil-English (Tanglish): 'oru water venum' = 'we need water'
- Mixed Hindi-English (Hinglish): 'paani chahiye' = 'water needed'
- Casual or incomplete phrasing

CRITICAL RULES — never violate:
1. NEVER invent quantities, units, numbers, or measurements that are not explicitly in the input. If the input says '100 people', do NOT add '100 liters'. If the input has no quantity for the supply, do NOT add one.
2. Distinguish between:
   - The number of PEOPLE affected (e.g., '100 families')
   - The QUANTITY of supplies needed (e.g., '200 bottles')
   - The DURATION of a situation (e.g., 'without water for a week')
   Never swap one for another.
3. If input says 'X for Y days', preserve both X and Y exactly. If input says 'without X for Y days', preserve the past-tense meaning — do NOT convert it to 'need X for Y days'.
4. Preserve units exactly as written (bottles, liters, kg, kits, packets, families, people). Do NOT change 'bottles' to 'liters'.
5. If a fact is not in the input, omit it. Better to be brief than to invent.

Rewrite the input into clear, professional English suitable for a disaster relief request. Preserve ALL facts: quantities, locations, deadlines, categories. Do NOT invent details. Do NOT add quantities or locations not present.
Max 80 characters for titles.

Raw title: ${rawTitle}
Description: ${description || 'None provided'}
Category: ${category}

Return ONLY valid JSON, no markdown fences:
{"improved_title": string, "reasoning": "one sentence", "changed": true or false}`

    const raw = await callAI(prompt, env, undefined, true)
    const parsed = cleanJSON(raw, {
      improved_title: rawTitle,
      reasoning: 'No adjustments needed.',
      changed: false,
    })

    return {
      improved_title: parsed.improved_title || rawTitle,
      reasoning: parsed.reasoning || '',
      changed: Boolean(parsed.changed),
    }
  }

  if (action === 'enhance-description') {
    const rawDescription = (body.rawDescription || '').trim()
    const title = (body.title || '').trim()
    const category = (body.category || 'General').trim()

    if (rawDescription.length > 3000) {
      throw new Error('INPUT_TOO_LONG: Description exceeds 3000 characters limit.')
    }

    const prompt = `Rewrite this disaster relief request description to be clear, structured, and urgent.

The input may contain:
- Broken sentences, shorthand, or unstructured notes
- Mixed Tamil-English (Tanglish) or Hindi-English (Hinglish)
- Missing context that can be inferred from the title: "${title}"
- Urgent bullet-point style or stream of consciousness

CRITICAL RULES — never violate:
1. NEVER invent quantities, units, numbers, or measurements that are not explicitly in the input. If the input says '100 people', do NOT add '100 liters'. If the input has no quantity for the supply, do NOT add one.
2. Distinguish between:
   - The number of PEOPLE affected (e.g., '100 families')
   - The QUANTITY of supplies needed (e.g., '200 bottles')
   - The DURATION of a situation (e.g., 'without water for a week')
   Never swap one for another.
3. If input says 'X for Y days', preserve both X and Y exactly. If input says 'without X for Y days', preserve the past-tense meaning — do NOT convert it to 'need X for Y days'.
4. Preserve units exactly as written (bottles, liters, kg, kits, packets, families, people). Do NOT change 'bottles' to 'liters'.
5. If a fact is not in the input, omit it. Better to be brief than to invent.

Structure the description clearly:
- Current situation & context
- Specific needs and quantities (exact match to input facts)
- Delivery / access notes (if mentioned)

Raw description: ${rawDescription}
Title: ${title}
Category: ${category}

Return ONLY valid JSON, no markdown fences:
{"improved_description": string, "reasoning": "one sentence", "changed": true or false}`

    const raw = await callAI(prompt, env, undefined, true)
    const parsed = cleanJSON(raw, {
      improved_description: rawDescription,
      reasoning: 'No adjustments needed.',
      changed: false,
    })

    return {
      improved_description: parsed.improved_description || rawDescription,
      reasoning: parsed.reasoning || '',
      changed: Boolean(parsed.changed),
    }
  }

  if (action === 'match-item') {
    const donorItem = (body.donorItem || '').trim()
    const requestedItem = (body.requestedItem || '').trim()

    if (donorItem.length > 300 || requestedItem.length > 300) {
      throw new Error('INPUT_TOO_LONG: Item description exceeds 300 characters limit.')
    }

    const prompt = `Compare what a donor is offering to what a disaster relief request is asking for.
Determine if the donor's item matches the requested item.

Donor is offering: "${donorItem}"
Request is asking for: "${requestedItem}"

CRITICAL RULES:
1. A match means the items serve the SAME relief purpose (e.g., 'Bisleri water bottles' matches 'drinking water', 'Dettol antiseptic' matches 'first aid kit', 'bread and jam' matches 'dry food packets').
2. Brand names match generic categories (e.g., 'Bisleri' = water, 'Parle-G' = biscuits/food, 'Crocin' = paracetamol/medicine).
3. If the donor item is completely unrelated (e.g., 'shoes' for 'drinking water'), it is NOT a match.
4. Try to extract the quantity the donor is offering if mentioned (e.g., '15 crates', '50 bottles', '100 packets'). If no quantity is mentioned, set converted_quantity to null.
5. Provide a confidence score from 0.0 to 1.0 (1.0 = exact match, 0.8+ = strong match, below 0.5 = not a match).

Return ONLY valid JSON, no markdown fences:
{"is_match": true or false, "confidence": number between 0 and 1, "reasoning": "brief explanation", "converted_quantity": number or null}`

    const raw = await callAI(prompt, env, undefined, true)
    const parsed = cleanJSON(raw, {
      is_match: false,
      confidence: 0,
      reasoning: 'Unable to evaluate match.',
      converted_quantity: null,
    })

    return {
      is_match: Boolean(parsed.is_match),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : (parsed.is_match ? 0.9 : 0.1),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      converted_quantity: typeof parsed.converted_quantity === 'number' ? parsed.converted_quantity : null,
    }
  }

  throw new Error(`INVALID_ACTION: Unknown action "${action}"`)
}

// Netlify Functions v2 handler
export default async (req: Request) => {
  cleanupRateLimits()

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // Rate limiting check
  const clientIp =
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('client-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'

  try {
    const body = (await req.json()) as AIRequestBody
    const rateCheck = checkRateLimit(clientIp, body.action || 'default')
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment before trying again.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60),
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    const result = await processAIRequest(body)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: any) {
    const msg = err?.message || ''
    if (msg.startsWith('INVALID_ACTION') || msg.startsWith('INPUT_TOO_LONG')) {
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    if (msg === 'NO_AI_KEY_CONFIGURED') {
      return new Response(
        JSON.stringify({ error: 'AI service not configured on server. Please set SARVAM_API_KEY in environment.' }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    // Mask upstream provider errors and internal stack traces
    console.error('[Server AI Error]:', err)
    return new Response(
      JSON.stringify({ error: 'AI service temporarily unavailable. Please try again later.' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }
}

// Netlify Functions v1 handler (backward compatibility)
export const handler = async (event: any) => {
  cleanupRateLimits()

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    const rateCheck = checkRateLimit(clientIp, body.action || 'default')
    if (!rateCheck.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter || 60),
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }),
      }
    }

    const result = await processAIRequest(body)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    }
  } catch (err: any) {
    const msg = err?.message || ''
    if (msg.startsWith('INVALID_ACTION') || msg.startsWith('INPUT_TOO_LONG')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: msg }),
      }
    }
    if (msg === 'NO_AI_KEY_CONFIGURED') {
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'AI service not configured on server.' }),
      }
    }

    console.error('[Server AI Error]:', err)
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'AI service temporarily unavailable.' }),
    }
  }
}
