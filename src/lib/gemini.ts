/**
 * Client-side AI service proxy for ReliefLink
 * 
 * Proxies AI operations to the secure server-side endpoint (/api/ai)
 * ensuring API keys (Sarvam AI / Google Gemini) are never exposed to
 * the client browser bundle or network traffic.
 */

export interface EnhanceTitleResult {
  improved_title: string
  reasoning: string
  changed: boolean
}

export interface EnhanceDescriptionResult {
  improved_description: string
  reasoning: string
  changed: boolean
}

export interface ItemMatchResult {
  is_match: boolean
  confidence: number
  reasoning: string
  converted_quantity: number | null
}

export interface AIParsedRequestItem {
  name: string
  category: string
  unit: string
  quantity: number
}

export interface AIParsedRequestResult {
  title: string
  description: string
  location: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  items: AIParsedRequestItem[]
  missing_info: string[]
}

export interface AIParsedDriveItem {
  name: string
  unit: string
  target_quantity: number
}

export interface AIParsedDriveResult {
  title: string
  description: string
  from_city: string
  to_city: string
  destination_event: string
  categories: string[]
  target_items: AIParsedDriveItem[]
  missing_info: string[]
}

const REGIONAL_SUPPLY_DICTIONARY: Record<string, string> = {
  // Water
  paani: 'water',
  pani: 'water',
  thanni: 'water',
  tanni: 'water',
  neer: 'water',
  jal: 'water',
  vellam: 'water',

  // Food / Meals
  khana: 'food',
  bhojan: 'food',
  unavu: 'food',
  saapadu: 'food',
  ahar: 'food',
  anna: 'food',

  // Rice / Grains
  chawal: 'rice',
  arisi: 'rice',
  bhaat: 'rice',
  dhan: 'rice',
  gehu: 'wheat',
  godhumai: 'wheat',
  dal: 'pulses',
  paruppu: 'pulses',

  // Medical / Medicines
  dawai: 'medicine',
  dawa: 'medicine',
  marundhu: 'medicine',
  aushadh: 'medicine',
  tablets: 'medicine',
  capsules: 'medicine',
  paracetamol: 'medicine',
  saline: 'medicine',
  ors: 'medicine',

  // Blanket / Shelter / Clothes
  kambal: 'blanket',
  kambili: 'blanket',
  kambuli: 'blanket',
  bedsheet: 'blanket',
  chadar: 'blanket',
  razai: 'blanket',
  kapde: 'cloth',
  thuni: 'cloth',
  vastra: 'cloth',
  dress: 'cloth',
  tirpaal: 'tarpaulin',
  tarpaulin: 'tarpaulin',
  tent: 'shelter',

  // Milk / Infant
  doodh: 'milk',
  paal: 'milk',
}

async function callServerAI<T>(payload: Record<string, any>): Promise<T> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    let message = `AI service error (${response.status})`
    try {
      const parsed = JSON.parse(errorBody)
      if (parsed.error) message = parsed.error
    } catch {
      // Use fallback error message
    }
    throw new Error(message)
  }

  return response.json()
}

/**
 * Enhances a raw disaster relief request title using secure server-side AI.
 */
export async function enhanceRequestTitle(
  rawTitle: string,
  description: string,
  category: string,
): Promise<EnhanceTitleResult> {
  return callServerAI<EnhanceTitleResult>({
    action: 'enhance-title',
    rawTitle,
    description,
    category,
  })
}

/**
 * Enhances a raw disaster relief request description using secure server-side AI.
 */
export async function enhanceRequestDescription(
  rawDescription: string,
  title: string,
  category: string,
): Promise<EnhanceDescriptionResult> {
  return callServerAI<EnhanceDescriptionResult>({
    action: 'enhance-description',
    rawDescription,
    title,
    category,
  })
}

/**
 * Matches a donor's item description to the requested supply item using secure server-side AI.
 */
export async function matchItemToRequest(
  donorItem: string,
  requestedItem: string,
): Promise<ItemMatchResult> {
  return callServerAI<ItemMatchResult>({
    action: 'match-item',
    donorItem,
    requestedItem,
  })
}

/**
 * Normalizes a user's search query (including Tanglish, Hinglish, regional terms, or synonyms)
 * to a standard English supply name using zero-latency local dictionary and secure server-side AI.
 */
export async function normalizeSearchQuery(queryText: string): Promise<string> {
  const trimmed = queryText.trim()
  if (!trimmed || trimmed.length <= 2) {
    return trimmed
  }

  // 1. Instant zero-latency regional dictionary lookup (runs purely client-side)
  const lower = trimmed.toLowerCase()
  if (REGIONAL_SUPPLY_DICTIONARY[lower]) {
    return REGIONAL_SUPPLY_DICTIONARY[lower]
  }

  // 2. Fall back to secure server-side AI for dynamic / unlisted translations
  try {
    const result = await callServerAI<{ normalized: string }>({
      action: 'normalize-search',
      queryText: trimmed,
    })
    return result.normalized || trimmed
  } catch (err) {
    console.warn('AI search normalization fallback to raw term:', err)
    return trimmed
  }
}

/**
 * Analyzes natural language description of a relief request and suggests prefilled fields.
 */
export async function parseReliefRequest(inputText: string): Promise<AIParsedRequestResult> {
  return callServerAI<AIParsedRequestResult>({
    action: 'parse-relief-request',
    inputText,
  })
}

/**
 * Analyzes natural language description of a collection drive and suggests prefilled logistics fields.
 */
export async function parseCollectionDrive(inputText: string): Promise<AIParsedDriveResult> {
  return callServerAI<AIParsedDriveResult>({
    action: 'parse-collection-drive',
    inputText,
  })
}
