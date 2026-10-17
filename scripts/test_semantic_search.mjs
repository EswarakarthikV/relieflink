import { chromium } from '@playwright/test'

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  try {
    console.log('Navigating to http://localhost:4174/browse...')
    await page.goto('http://localhost:4174/browse', { waitUntil: 'networkidle' })

    const searchInput = page.locator('#browse-search')
    await searchInput.waitFor({ state: 'visible' })
    console.log('Search input is visible')

    // Initial requests count
    const initialCards = await page.locator('article, .rounded-card').count()
    console.log('Initial request cards on feed:', initialCards)

    // Type "kambili"
    console.log('Typing "kambili" (Tanglish for blanket)...')
    await searchInput.fill('kambili')

    // Expect spinner to appear during AI normalization
    const spinner = page.locator('role=status')
    console.log('Waiting for AI translation and translation pill...')
    
    // Wait for the translation pill: "Searching for: blanket"
    const pill = page.locator('text=/Searching for:\\s*blanket/i')
    await pill.waitFor({ state: 'visible', timeout: 10000 })
    console.log('Translation pill appeared successfully: "Searching for: blanket"')

    // Check request cards filtered for blanket (e.g. Shelter kits, blankets)
    const filteredCards = page.locator('article, .rounded-card')
    const count = await filteredCards.count()
    console.log(`Matching cards found for "kambili" -> "blanket": ${count}`)
    const firstText = await filteredCards.first().innerText()
    console.log('Snippet of first matching card:\n', firstText.substring(0, 150))
    if (!firstText.toLowerCase().includes('blanket') && !firstText.toLowerCase().includes('shelter')) {
      throw new Error('Result does not match blanket!')
    }

    // Now test standard English term (e.g. "water")
    console.log('\nTesting standard English term "water"...')
    await searchInput.fill('water')
    await page.waitForTimeout(1000)

    // Should find water requests
    const waterCards = await page.locator('article, .rounded-card').count()
    console.log(`Cards matching "water": ${waterCards}`)
    if (waterCards === 0) {
      throw new Error('Expected results for "water"')
    }

    console.log('\nALL SEMANTIC SEARCH TESTS PASSED SUCCESSFULLY! ✅')
  } catch (err) {
    console.error('Semantic search test failed:', err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

run()
