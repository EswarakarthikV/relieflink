import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runTests() {
  console.log('Starting verification of UI changes...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Verify MakeOfferSheet: AI item matching removed
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing MakeOfferSheet (AI Item Matching Removed) ---')
    await page.goto(`${BASE_URL}/requests/req-001`, { waitUntil: 'networkidle' })

    const makeOfferBtn = page.getByRole('button', { name: /Make an Offer/i }).first()
    await makeOfferBtn.click()

    await page.locator('text=Make an Offer').first().waitFor({ state: 'visible' })

    // Check that "What exactly are you providing?" is NOT present
    const aiInput = page.locator('#donor-item-name')
    const aiLabel = page.locator('text=What exactly are you providing?')
    const checkMatchBtn = page.getByRole('button', { name: /Check match/i })

    if (await aiInput.isVisible()) throw new Error('"What exactly are you providing?" input is still visible!')
    if (await aiLabel.isVisible()) throw new Error('AI label is still visible!')
    if (await checkMatchBtn.isVisible()) throw new Error('"Check match" button is still visible!')

    // Verify quantity stepper remains intact
    const decreaseBtn = page.locator('button[aria-label="Decrease quantity"]')
    const increaseBtn = page.locator('button[aria-label="Increase quantity"]')
    if (!(await decreaseBtn.isVisible())) throw new Error('Quantity stepper decrease button missing!')
    if (!(await increaseBtn.isVisible())) throw new Error('Quantity stepper increase button missing!')
    console.log('✓ AI item matching elements removed; quantity stepper remains completely functional.')

    // Close sheet
    const closeBtn = page.locator('button[aria-label="Close modal"]')
    if (await closeBtn.isVisible()) await closeBtn.click()

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Verify BrowsePage Search Bar
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing BrowsePage Search Bar ---')
    await page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' })

    const searchInput = page.locator('#browse-search')
    await searchInput.waitFor({ state: 'visible' })

    const placeholder = await searchInput.getAttribute('placeholder')
    console.log(`Search placeholder: "${placeholder}"`)
    if (!placeholder?.includes('Search requests by item or location')) {
      throw new Error(`Unexpected placeholder: "${placeholder}"`)
    }

    // Test item-based filtering (e.g. "Water")
    console.log('Searching for item "Water"...')
    await searchInput.fill('Water')
    await page.waitForTimeout(300)

    const waterResults = await page.locator('article, [class*="rounded-card"]').allInnerTexts()
    console.log(`Results count for "Water": ${waterResults.length}`)
    if (waterResults.length === 0) throw new Error('Expected results for "Water"')

    // Test location-based filtering (e.g. "Shivajinagar")
    console.log('Searching for location "Shivajinagar"...')
    await searchInput.fill('Shivajinagar')
    await page.waitForTimeout(300)

    const shivajiResults = await page.locator('article, [class*="rounded-card"]').allInnerTexts()
    console.log(`Results count for "Shivajinagar": ${shivajiResults.length}`)
    if (shivajiResults.length === 0) throw new Error('Expected results for "Shivajinagar"')

    // Test non-matching query
    console.log('Searching for non-matching term "xyz999"...')
    await searchInput.fill('xyz999')
    await page.waitForTimeout(300)

    const noResultsText = page.locator('text=No requests found')
    if (!(await noResultsText.isVisible())) throw new Error('"No requests found" empty state not shown!')
    console.log('✓ Search bar filters requests by item or location accurately')

    console.log('\nALL VERIFICATION TESTS PASSED! 🚀')
  } catch (err) {
    console.error('Test run failed:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

runTests()
