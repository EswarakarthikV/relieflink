const apiKey = 'sk_mugkdmcy_0ZaYtNqRoqhZadk8ER6K3PNC'
const query = 'kambili'
const prompt = `You are a search normalizer for an Indian disaster relief app. 
Translate the following local language or Tanglish/Hinglish term into the standard English supply name. 
Examples: thanni/neer/tanni -> water, kapde/thuni -> cloth, kambili/kambuli/bedsheet -> blanket, unavu/saapadu -> food, marundhu -> medicine.
If the input is already standard English, return it as is.
Return ONLY the single English word, nothing else. No explanations.

User input: ${query}`

async function test() {
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
  const data = await res.json()
  console.log('Result:', data?.choices?.[0]?.message?.content)
}

test()
