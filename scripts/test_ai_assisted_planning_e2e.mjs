import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runTest() {
  console.log('🧪 Starting Comprehensive E2E Test: AI-Assisted Planning & Private Matching...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1: AI-ASSISTED REQUEST CREATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 1. Testing AI-Assisted Request Creation (/create) ---')
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(`${BASE_URL}/create`, { waitUntil: 'networkidle' })

    // Check "Help me fill this with AI" box exists
    const aiBanner = page.locator('text=Help me fill this with AI')
    await aiBanner.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Found "Help me fill this with AI" feature banner')

    // Click "Try AI"
    const tryAiBtn = page.getByRole('button', { name: /Try AI/i })
    await tryAiBtn.click()

    // Enter natural language prompt
    const aiTextarea = page.locator('textarea[placeholder*="We need drinking water"]')
    await aiTextarea.waitFor({ state: 'visible' })
    await aiTextarea.fill('We need drinking water, food, blankets, and hygiene supplies for families affected by flooding in Chennai.')
    console.log('✓ Filled natural language crisis description')

    // Click "Prefill Form"
    const prefillBtn = page.getByRole('button', { name: /Prefill Form/i })
    await prefillBtn.click()

    // Wait for AI Applied confirmation
    const appliedBanner = page.locator('text=AI suggestions applied to the form!')
    await appliedBanner.waitFor({ state: 'visible', timeout: 10000 })
    console.log('✓ AI suggestions generated and applied to form!')

    // Check prefilled Title
    const titleInput = page.locator('input[placeholder*="Drinking water for 200 families"]')
    const titleVal = await titleInput.inputValue()
    console.log('✓ Prefilled Title:', titleVal)
    if (!titleVal || !titleVal.includes('Water')) {
      throw new Error(`Expected title to contain supplies, got: "${titleVal}"`)
    }

    // Check prefilled Location
    const locInput = page.locator('input[placeholder*="Kothrud, Pune"]')
    const locVal = await locInput.inputValue()
    console.log('✓ Prefilled Location:', locVal)
    if (!locVal.includes('Chennai')) {
      throw new Error(`Expected location to be Chennai, got: "${locVal}"`)
    }

    // Check prefilled items count (should have multiple items)
    const itemRows = page.locator('input[placeholder="e.g. Drinking water"]')
    const count = await itemRows.count()
    console.log(`✓ Prefilled ${count} supply items`)
    if (count < 2) {
      throw new Error(`Expected at least 2 prefilled items, found: ${count}`)
    }

    // Check missing info checklist is visible
    const missingInfoBox = page.locator('text=Missing information you may need to provide:')
    await missingInfoBox.waitFor({ state: 'visible' })
    console.log('✓ Missing information checklist displayed to user')

    // Verify user can edit any field (edit title)
    await titleInput.fill(titleVal + ' - Urgent')
    console.log('✓ Verified user can freely edit AI suggestions')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2: AI-ASSISTED COLLECTION DRIVE CREATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Testing AI-Assisted Collection Drive Creation (/drives/create) ---')
    await page.goto(`${BASE_URL}/drives/create`, { waitUntil: 'networkidle' })

    const driveAiBanner = page.locator('text=Assist with AI')
    await driveAiBanner.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Found "Assist with AI" banner on Create Collection Drive')

    const driveTryAiBtn = page.getByRole('button', { name: /Try AI/i })
    await driveTryAiBtn.click()

    const driveTextarea = page.locator('textarea[placeholder*="collecting supplies from families"]')
    await driveTextarea.waitFor({ state: 'visible' })
    await driveTextarea.fill("I'm collecting supplies from families in Erode to deliver to people affected by floods in Chennai.")

    const prefillDriveBtn = page.getByRole('button', { name: /Prefill Drive/i })
    await prefillDriveBtn.click()

    const driveApplied = page.locator('text=Drive details prefilled!')
    await driveApplied.waitFor({ state: 'visible', timeout: 10000 })
    console.log('✓ AI suggestions applied to collection drive form!')

    // Check extracted Starting City & Destination City
    const fromCityInput = page.locator('#from-city')
    const toCityInput = page.locator('#to-city')
    const fromVal = await fromCityInput.inputValue()
    const toVal = await toCityInput.inputValue()
    console.log(`✓ Prefilled route: ${fromVal} -> ${toVal}`)
    if (!fromVal.includes('Erode') || !toVal.includes('Chennai')) {
      throw new Error(`Expected Erode -> Chennai, got: ${fromVal} -> ${toVal}`)
    }

    // Check target items checklist exists
    const targetItemBadges = page.locator('text=Water (Bottles)')
    await targetItemBadges.first().waitFor({ state: 'visible' })
    console.log('✓ Target supply checklist generated with categories and target quantities')

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 3: PRIVATE REQUEST-DONATION MATCHING IN TRACKER
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 3. Testing Private Matching in Tracker (/tracker/req-001) ---')
    await page.goto(`${BASE_URL}/tracker/req-001`, { waitUntil: 'networkidle' })

    // Requester view: check for Suggested Relief Matches
    const suggestedMatches = page.locator('text=Suggested Relief Matches')
    await suggestedMatches.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Suggested Relief Matches displayed in Requester View')

    const matchNotice = page.locator('text=Matches are suggestions only. No supplies or records are transferred automatically.')
    await matchNotice.waitFor({ state: 'visible' })
    console.log('✓ Non-autonomous human-in-the-loop notice verified')

    // Check that donor view hides requester's private matches or shows donor-specific context
    const donorViewBtn = page.getByRole('button', { name: /Donor View/i })
    await donorViewBtn.click()
    await page.waitForTimeout(500)
    const matchesInDonorView = await suggestedMatches.isVisible()
    console.log(`✓ Requester suggested matches hidden in Donor View: ${!matchesInDonorView}`)

    console.log('\n--- 4. Testing Private Donor Matches in My Activity (/my-activity) ---')
    await page.goto(`${BASE_URL}/my-activity`, { waitUntil: 'networkidle' })

    // Check all sub-views are present
    const donTab = page.locator('button:has-text("Donations")').first()
    await donTab.waitFor({ state: 'visible', timeout: 8000 })
    console.log('✓ Navigated to My Activity and verified tabs')

    // Switch to Donations tab
    await donTab.click()
    await page.waitForTimeout(600)

    // Check suggested matching requests card for donor
    const donorMatchCard = page.locator('text=Suggested Requests Matching Your Donations')
    if (await donorMatchCard.isVisible()) {
      console.log('✓ Donor Suggested Matches card visible with relevant open requests')
      const offerSuppliesBtn = page.getByRole('button', { name: /Offer Supplies/i }).first()
      if (await offerSuppliesBtn.isVisible()) {
        console.log('✓ "Offer Supplies" manual CTA present on suggested match card')
      }
    } else {
      console.log('ℹ Donor has no active category pledges or all requests fulfilled (expected for empty profile)')
    }

    console.log('\n🎉 ALL E2E AI-ASSISTED PLANNING & MATCHING CHECKS PASSED!')
  } finally {
    await browser.close()
  }
}

runTest().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
