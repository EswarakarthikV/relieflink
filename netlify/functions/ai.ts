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
  action:
    | 'normalize-search'
    | 'enhance-title'
    | 'enhance-description'
    | 'match-item'
    | 'parse-relief-request'
    | 'parse-collection-drive'
  queryText?: string
  rawTitle?: string
  rawDescription?: string
  title?: string
  description?: string
  category?: string
  donorItem?: string
  requestedItem?: string
  inputText?: string
}

const ALLOWED_ACTIONS = new Set([
  'normalize-search',
  'enhance-title',
  'enhance-description',
  'match-item',
  'parse-relief-request',
  'parse-collection-drive',
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
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash']
  let lastError: any = new Error('Gemini API call failed')

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
        lastError = new Error(`Gemini ${res.status}: ${errorText}`)
        continue
      }

      const data = await res.json()
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (content) return content
    } catch (err) {
      lastError = err
    }
  }

  throw lastError
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

  if (action === 'parse-relief-request') {
    const inputText = (body.inputText || '').trim()
    if (!inputText) {
      throw new Error('INPUT_TOO_SHORT: Please provide a description of the situation.')
    }
    if (inputText.length > 3000) {
      throw new Error('INPUT_TOO_LONG: Request description exceeds 3000 characters limit.')
    }

    const prompt = `You are a disaster relief assistant analyzing a crisis request in India.
Analyze the following natural language description from a requester and extract structured relief details.

Input text: "${inputText}"

CRITICAL RULES — NEVER VIOLATE:
1. Suggest a concise, clear title (max 80 chars) summarizing what is needed.
2. Structure the description professionally: context/situation, specific needs, and access notes if any.
3. Destination/location: Extract ONLY locations (city, district, area, camp) EXPLICITLY mentioned in the input. If no location is mentioned, return "".
4. Supply items: Identify specific needed supplies mentioned.
   - For each item, specify name, category ('Water' | 'Food' | 'Hygiene' | 'Medical' | 'Shelter' | 'Other'), unit ('bottles' | 'kg' | 'kits' | 'liters' | 'packets' | 'units'), and proposed quantity.
   - If a quantity is mentioned (e.g. '200 bottles', '50 kg', 'for 100 people'), use that quantity. If no quantity is mentioned for an item, suggest a reasonable initial starting quantity (e.g. 50 or 100).
5. Urgency: Choose 'critical' ONLY if life-threatening emergencies, medical crisis, or severe drowning/starvation is stated. Choose 'high' for flood displacement, heavy rains, or power cuts. Otherwise choose 'medium' or 'low'.
6. Missing information: List what critical information the user did NOT provide (e.g., 'Contact phone number', 'Exact delivery landmark/address', 'Number of affected individuals').
7. Never invent facts, incidents, or relief camps not supported by the input.

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "description": string,
  "location": string,
  "urgency": "low" | "medium" | "high" | "critical",
  "items": [
    { "name": string, "category": string, "unit": string, "quantity": number }
  ],
  "missing_info": string[]
}`

    let result: any = null
    try {
      const raw = await callAI(prompt, env, undefined, true)
      result = cleanJSON(raw, null)
    } catch (err) {
      console.warn('[Server AI] Upstream AI failed for parse-relief-request, using heuristic NLP fallback:', err)
    }

    if (!result || !result.title || !Array.isArray(result.items)) {
      result = fallbackParseReliefRequest(inputText)
    }

    return result
  }

  if (action === 'parse-collection-drive') {
    const inputText = (body.inputText || '').trim()
    if (!inputText) {
      throw new Error('INPUT_TOO_SHORT: Please provide a description of the drive.')
    }
    if (inputText.length > 3000) {
      throw new Error('INPUT_TOO_LONG: Description exceeds 3000 characters limit.')
    }

    const prompt = `You are a disaster logistics assistant for Indian citizen collection drives.
Analyze the following natural language description of a citizen relief collection drive.

Input text: "${inputText}"

CRITICAL RULES — NEVER VIOLATE:
1. Identify the starting/collection location ('from_city').
2. Identify the destination location ('to_city').
3. Identify the relief event/purpose ('destination_event', e.g. 'Floods in Chennai', 'Cyclone Relief').
4. Suggest a clear title (e.g. 'Erode to Chennai Flood Relief Drive').
5. Suggest a structured description explaining the drive, who is organizing, and where supplies are going.
6. Identify relevant supply categories and target supply items with realistic target quantities.
7. NEVER invent affected-person counts, active incidents, relief-camp names, or confirmed requests not mentioned in the input.

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "description": string,
  "from_city": string,
  "to_city": string,
  "destination_event": string,
  "categories": string[],
  "target_items": [
    { "name": string, "unit": string, "target_quantity": number }
  ],
  "missing_info": string[]
}`

    let result: any = null
    try {
      const raw = await callAI(prompt, env, undefined, true)
      result = cleanJSON(raw, null)
    } catch (err) {
      console.warn('[Server AI] Upstream AI failed for parse-collection-drive, using heuristic NLP fallback:', err)
    }

    if (!result || !result.title || !Array.isArray(result.target_items)) {
      result = fallbackParseCollectionDrive(inputText)
    }

    return result
  }

  throw new Error(`INVALID_ACTION: Unknown action "${action}"`)
}

// ----------------------------------------------------------------------------
// Heuristic Rule-Based Disaster NLP Fallbacks (Zero-Failure Offline Resilience)
// ----------------------------------------------------------------------------

function fallbackParseReliefRequest(text: string) {
  const lower = text.toLowerCase()
  const items: Array<{ name: string; category: string; unit: string; quantity: number }> = []

  // Extract common disaster supplies
  if (lower.includes('water') || lower.includes('thanni') || lower.includes('pani') || lower.includes('paani') || lower.includes('neer')) {
    items.push({ name: 'Drinking Water', category: 'Water', unit: 'bottles', quantity: 100 })
  }
  if (lower.includes('food') || lower.includes('ration') || lower.includes('khana') || lower.includes('unavu') || lower.includes('saapadu') || lower.includes('biscuit') || lower.includes('rice') || lower.includes('arisi')) {
    items.push({ name: 'Food & Rations', category: 'Food', unit: 'packets', quantity: 50 })
  }
  if (lower.includes('blanket') || lower.includes('kambal') || lower.includes('kambili') || lower.includes('bedsheet') || lower.includes('sheet')) {
    items.push({ name: 'Warm Blankets', category: 'Shelter', unit: 'units', quantity: 40 })
  }
  if (lower.includes('hygiene') || lower.includes('soap') || lower.includes('pad') || lower.includes('sanitary') || lower.includes('toothpaste')) {
    items.push({ name: 'Hygiene Kits', category: 'Hygiene', unit: 'kits', quantity: 30 })
  }
  if (lower.includes('medical') || lower.includes('medicine') || lower.includes('first aid') || lower.includes('dawai') || lower.includes('marundhu') || lower.includes('tablet')) {
    items.push({ name: 'First Aid & Medicines', category: 'Medical', unit: 'kits', quantity: 20 })
  }
  if (lower.includes('tarpaulin') || lower.includes('shelter') || lower.includes('tent') || lower.includes('tirpaal')) {
    items.push({ name: 'Tarpaulins / Shelter', category: 'Shelter', unit: 'units', quantity: 20 })
  }

  if (items.length === 0) {
    items.push({ name: 'Emergency Supplies', category: 'Other', unit: 'units', quantity: 50 })
  }

  // Location heuristic (common Indian disaster hubs or capitalized patterns)
  let location = ''
  const cityMatches = text.match(/\b(Chennai|Erode|Coimbatore|Madurai|Salem|Tirunelveli|Trichy|Thoothukudi|Cuddalore|Kanchipuram|Mumbai|Pune|Kerala|Wayanad|Delhi|Bengaluru|Bangalore|Kolkata)\b/i)
  if (cityMatches) {
    location = cityMatches[1]
  }

  // Urgency heuristic
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  if (lower.includes('critical') || lower.includes('trapped') || lower.includes('drowning') || lower.includes('life') || lower.includes('emergency')) {
    urgency = 'critical'
  } else if (lower.includes('flood') || lower.includes('urgent') || lower.includes('asap') || lower.includes('heavy rain') || lower.includes('cyclone')) {
    urgency = 'high'
  }

  // Missing info check
  const missing_info: string[] = []
  if (!location) missing_info.push('Exact delivery location or landmark')
  if (!text.match(/\d+/)) missing_info.push('Specific counts of affected individuals or families')
  missing_info.push('Contact phone number for on-ground coordination')

  const titleWords = items.map(i => i.name).slice(0, 3).join(', ')
  const title = location
    ? `Emergency ${titleWords} Needed in ${location}`
    : `Emergency ${titleWords} Needed`

  return {
    title: title.length > 80 ? title.substring(0, 77) + '...' : title,
    description: `Situation: ${text.trim()}\n\nRequired immediate relief: ${items.map(i => `${i.quantity} ${i.unit} of ${i.name}`).join(', ')}.`,
    location,
    urgency,
    items,
    missing_info,
  }
}

function fallbackParseCollectionDrive(text: string) {
  const lower = text.toLowerCase()

  // Known city extraction (prioritize known hubs like Erode, Chennai, etc.)
  let from_city = ''
  let to_city = ''
  const knownCities = [
    'Chennai', 'Erode', 'Coimbatore', 'Madurai', 'Salem', 'Tirunelveli',
    'Trichy', 'Thoothukudi', 'Cuddalore', 'Kanchipuram', 'Mumbai', 'Pune',
    'Kerala', 'Wayanad', 'Delhi', 'Bengaluru', 'Bangalore', 'Kolkata'
  ]
  const foundKnown: string[] = []
  for (const c of knownCities) {
    const rx = new RegExp(`\\b${c}\\b`, 'i')
    if (rx.test(text)) {
      foundKnown.push(c)
    }
  }

  if (foundKnown.length >= 2) {
    // Determine order from text
    const idx0 = text.toLowerCase().indexOf(foundKnown[0].toLowerCase())
    const idx1 = text.toLowerCase().indexOf(foundKnown[1].toLowerCase())
    if (idx0 <= idx1) {
      from_city = foundKnown[0]
      to_city = foundKnown[1]
    } else {
      from_city = foundKnown[1]
      to_city = foundKnown[0]
    }
  } else if (foundKnown.length === 1) {
    to_city = foundKnown[0]
  } else {
    const fromToMatch = text.match(/from\s+([a-zA-Z\s]+?)\s+(?:to|for)\s+([a-zA-Z\s]+?)(?:[,.]|$|\s+to\s+deliver)/i)
    if (fromToMatch) {
      from_city = fromToMatch[1].trim()
      to_city = fromToMatch[2].trim()
    }
  }

  // Event
  let destination_event = 'Disaster Relief'
  if (lower.includes('flood')) destination_event = 'Flood Relief'
  else if (lower.includes('cyclone')) destination_event = 'Cyclone Relief'
  else if (lower.includes('landslide')) destination_event = 'Landslide Relief'
  else if (lower.includes('rain')) destination_event = 'Heavy Rain Relief'

  // Items
  const target_items: Array<{ name: string; unit: string; target_quantity: number }> = []
  const categories: string[] = []

  if (lower.includes('water') || lower.includes('thanni') || lower.includes('pani')) {
    target_items.push({ name: 'Water (Bottles)', unit: 'bottles', target_quantity: 100 })
    categories.push('Water')
  }
  if (lower.includes('food') || lower.includes('ration') || lower.includes('biscuit') || lower.includes('bread')) {
    target_items.push({ name: 'Food & Rations', unit: 'packs', target_quantity: 100 })
    categories.push('Food')
  }
  if (lower.includes('blanket') || lower.includes('kambal') || lower.includes('kambili') || lower.includes('sheet')) {
    target_items.push({ name: 'Warm Blankets', unit: 'pieces', target_quantity: 50 })
    categories.push('Blankets')
  }
  if (lower.includes('hygiene') || lower.includes('soap') || lower.includes('pad') || lower.includes('sanitary')) {
    target_items.push({ name: 'Hygiene Kits', unit: 'kits', target_quantity: 50 })
    categories.push('Hygiene')
  }
  if (lower.includes('medical') || lower.includes('medicine') || lower.includes('first aid')) {
    target_items.push({ name: 'Medical Supplies', unit: 'kits', target_quantity: 30 })
    categories.push('Medical')
  }

  if (target_items.length === 0) {
    target_items.push(
      { name: 'Water (Bottles)', unit: 'bottles', target_quantity: 100 },
      { name: 'Food & Rations', unit: 'packs', target_quantity: 100 },
      { name: 'Warm Blankets', unit: 'pieces', target_quantity: 50 },
    )
    categories.push('Water', 'Food', 'Blankets')
  }

  const title = from_city && to_city
    ? `${from_city} to ${to_city} ${destination_event}`
    : to_city
      ? `${to_city} Community ${destination_event}`
      : `Citizen Community ${destination_event}`

  const missing_info: string[] = []
  if (!from_city) missing_info.push('Collection starting city')
  if (!to_city) missing_info.push('Destination city')
  missing_info.push('Specific collection center address and departure date')

  return {
    title,
    description: `Community collection drive: ${text.trim()}\n\nCollecting essential relief supplies for distribution to affected families.`,
    from_city,
    to_city,
    destination_event: to_city ? `${to_city} ${destination_event}` : destination_event,
    categories,
    target_items,
    missing_info,
  }
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
