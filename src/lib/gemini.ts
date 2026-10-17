/**
 * Sarvam AI & Gemini API client for AI features
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

interface SarvamOptions {
  useResponseFormat?: boolean
  label?: 'Title' | 'Description' | 'ItemMatch' | string
  systemPrompt?: string
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

async function callSarvamAPI(
  prompt: string,
  apiKey: string,
  options: SarvamOptions = {},
): Promise<string> {
  const { useResponseFormat = true, label } = options
  const modelsToTry = ['sarvam-105b-conversations', 'sarvam-105b', 'sarvam-m']
  let lastError: Error = new Error('Sarvam API call failed')

  for (const model of modelsToTry) {
    const body: Record<string, any> = {
      model,
      messages: [
        {
          role: 'system',
          content: options.systemPrompt ?? SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    }

    if (useResponseFormat) {
      body.response_format = { type: 'json_object' }
    }

    if (label) {
      console.log(`${label} body:`, JSON.stringify(body))
    }

    const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('Sarvam error:', response.status, errorText)
      lastError = new Error(`Sarvam ${response.status}: ${errorText}`)
      if (response.status === 400 && errorText.includes('deprecated')) {
        continue
      }
      throw lastError
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      lastError = new Error('Invalid or empty content from Sarvam API')
      continue
    }
    return content
  }

  throw lastError
}


async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    },
  )

  if (!response.ok) {
    const errorBody = await response.text()
    let errorMessage = `Gemini API error (${response.status})`
    try {
      const parsedError = JSON.parse(errorBody)
      if (parsedError.error?.message) {
        errorMessage = parsedError.error.message
      }
    } catch {
      // Use fallback error message
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!rawOutput) {
    throw new Error('Invalid or empty response received from Gemini API')
  }

  return rawOutput
}

/**
 * Enhances a raw disaster relief request title using Sarvam AI (with Gemini fallback).
 * Returns structured JSON with improved_title, reasoning, and changed boolean.
 */
export async function enhanceRequestTitle(
  rawTitle: string,
  description: string,
  category: string,
): Promise<EnhanceTitleResult> {
  const sarvamKey = (import.meta.env.VITE_SARVAM_API_KEY as string | undefined)?.trim()
  const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()

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
Category: ${category || 'General'}

Return ONLY valid JSON, no markdown fences:
{"improved_title": string, "reasoning": "one sentence", "changed": true or false}`

  let rawOutput = ''
  let originalError: any = null

  if (sarvamKey) {
    try {
      rawOutput = await callSarvamAPI(prompt, sarvamKey, { useResponseFormat: true, label: 'Title' })
      console.log('Title enhanced via: Sarvam')
    } catch (err) {
      originalError = err
    }
  }

  if (!rawOutput) {
    if (geminiKey) {
      try {
        rawOutput = await callGeminiAPI(prompt, geminiKey)
        console.log('Title enhanced via: Gemini fallback')
      } catch (geminiErr) {
        throw originalError || geminiErr
      }
    } else {
      throw originalError || new Error('No AI API key is configured. Please set VITE_SARVAM_API_KEY or VITE_GEMINI_API_KEY in .env.local')
    }
  }

  const cleaned = rawOutput
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let jsonString = cleaned
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonString = jsonMatch[0]
  }

  const result = JSON.parse(jsonString)

  return {
    improved_title: typeof result.improved_title === 'string' ? result.improved_title : rawTitle,
    reasoning: typeof result.reasoning === 'string' ? result.reasoning : '',
    changed: Boolean(result.changed),
  }
}

/**
 * Enhances a raw disaster relief request description using Sarvam AI (with Gemini fallback).
 * Returns structured JSON with improved_description, reasoning, and changed boolean.
 */
export async function enhanceRequestDescription(
  rawDescription: string,
  title?: string,
  category?: string,
): Promise<EnhanceDescriptionResult> {
  const sarvamKey = (import.meta.env.VITE_SARVAM_API_KEY as string | undefined)?.trim()
  const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()

  const truncatedDesc = (rawDescription || '').slice(0, 500)

  const prompt = `Rewrite this disaster relief request description to be clear and specific.

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
2-4 sentences for descriptions.

Raw description: ${truncatedDesc}
Title: ${title || 'None provided'}
Category: ${category || 'General'}

Return ONLY valid JSON, no markdown fences, no explanations:
{"improved_description": string, "reasoning": "one sentence", "changed": true or false}`

  let rawOutput = ''
  let originalError: any = null

  if (sarvamKey) {
    try {
      rawOutput = await callSarvamAPI(prompt, sarvamKey, { useResponseFormat: false, label: 'Description' })
      console.log('Description enhanced via: Sarvam')
    } catch (err) {
      originalError = err
    }
  }

  if (!rawOutput) {
    if (geminiKey) {
      try {
        rawOutput = await callGeminiAPI(prompt, geminiKey)
        console.log('Description enhanced via: Gemini fallback')
      } catch (geminiErr) {
        throw originalError || geminiErr
      }
    } else {
      throw originalError || new Error('No AI API key is configured. Please set VITE_SARVAM_API_KEY or VITE_GEMINI_API_KEY in .env.local')
    }
  }

  const cleaned = rawOutput
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let jsonString = cleaned
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonString = jsonMatch[0]
  }

  const result = JSON.parse(jsonString)

  return {
    improved_description: typeof result.improved_description === 'string' ? result.improved_description : rawDescription,
    reasoning: typeof result.reasoning === 'string' ? result.reasoning : '',
    changed: Boolean(result.changed),
  }
}

/**
 * Matches a donor's item description to the requested supply item using Sarvam AI (with Gemini fallback).
 * Returns structured JSON with is_match, confidence, reasoning, and converted_quantity.
 */
export async function matchItemToRequest(
  donorText: string,
  requestItemName: string,
  remainingQty: number,
): Promise<ItemMatchResult> {
  const sarvamKey = (import.meta.env.VITE_SARVAM_API_KEY as string | undefined)?.trim()
  const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()

  const prompt = `You are matching disaster relief donations to requests.
REQUESTER NEEDS: ${requestItemName} (remaining: ${remainingQty})
DONOR OFFERS: ${donorText}
Return ONLY valid JSON, no markdown fences, no explanations:
{
  "is_match": boolean,
  "confidence": 0.0 to 1.0,
  "reasoning": "one sentence",
  "converted_quantity": number or null
}`

  let rawOutput = ''
  let originalError: any = null

  if (sarvamKey) {
    try {
      rawOutput = await callSarvamAPI(prompt, sarvamKey, {
        useResponseFormat: false,
        label: 'ItemMatch',
        systemPrompt: 'You are a disaster relief assistant matching donations to requests. Output ONLY valid JSON.',
      })
      console.log('Item matched via: Sarvam')
    } catch (err) {
      originalError = err
    }
  }

  if (!rawOutput) {
    if (geminiKey) {
      try {
        rawOutput = await callGeminiAPI(prompt, geminiKey)
        console.log('Item matched via: Gemini fallback')
      } catch (geminiErr) {
        throw originalError || geminiErr
      }
    } else {
      throw originalError || new Error('No AI API key is configured. Please set VITE_SARVAM_API_KEY or VITE_GEMINI_API_KEY in .env.local')
    }
  }

  const cleaned = rawOutput
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let jsonString = cleaned
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonString = jsonMatch[0]
  }

  const result = JSON.parse(jsonString)

  return {
    is_match: Boolean(result.is_match),
    confidence: typeof result.confidence === 'number' ? result.confidence : (result.is_match ? 0.9 : 0.1),
    reasoning: typeof result.reasoning === 'string' ? result.reasoning : '',
    converted_quantity: typeof result.converted_quantity === 'number' ? result.converted_quantity : null,
  }
}

