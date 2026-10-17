import fs from 'fs'

// Read API key from runtime environment variables without hardcoding
let apiKey = (process.env.SARVAM_API_KEY || process.env.VITE_SARVAM_API_KEY || '').trim()

// Fallback to reading from local .env.local file at runtime if present
if (!apiKey && fs.existsSync('.env.local')) {
  try {
    const content = fs.readFileSync('.env.local', 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('SARVAM_API_KEY=')) {
        apiKey = trimmed.substring('SARVAM_API_KEY='.length).trim()
        break
      }
      if (trimmed.startsWith('VITE_SARVAM_API_KEY=')) {
        apiKey = trimmed.substring('VITE_SARVAM_API_KEY='.length).trim()
        break
      }
    }
  } catch {
    // Ignore read errors
  }
}

if (!apiKey) {
  console.log('SARVAM_API_KEY not configured in environment or .env.local. Skipping direct test.')
  process.exit(0)
}

const query = 'kambili'
const prompt = `You are a search normalizer for an Indian disaster relief app. 
Translate the following local language or Tanglish/Hinglish term into the standard English supply name. 
Examples: thanni/neer/tanni -> water, kapde/thuni -> cloth, kambili/kambuli/bedsheet -> blanket, unavu/saapadu -> food, marundhu -> medicine.
If the input is already standard English, return it as is.
Return ONLY the single English word, nothing else. No explanations.

User input: ${query}`

async function test() {
  try {
    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [
          { role: 'system', content: 'You are a search normalizer. Return only the single English word.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    })

    if (!res.ok) {
      console.log(`Sarvam API responded with status ${res.status}`)
      return
    }

    const data = await res.json()
    console.log('Result:', data?.choices?.[0]?.message?.content?.trim())
  } catch (err) {
    console.log('Sarvam API test encountered network error:', err?.message || err)
  }
}

test()
