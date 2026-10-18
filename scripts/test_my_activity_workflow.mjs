import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function testMyActivityAndWorkflow() {
  console.log('🧪 Starting Test: My Activity Hub, Tracker Workflow & Operational Home...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

    // ── 1. Operational Home Page ──────────────────────────────────────────────
    console.log('1. Checking Operational Home Page...')
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })

    // Quick action cards
    const reqAidCard = page.locator('text=Request Aid')
    const offerSuppliesCard = page.locator('text=Offer Supplies')
    const organizeDriveCard = page.locator('text=Organize Drive')
    const nearMeCard = page.locator('text=Near Me')

    if (!(await reqAidCard.first().isVisible())) throw new Error('Missing "Request Aid" quick action')
    if (!(await offerSuppliesCard.first().isVisible())) throw new Error('Missing "Offer Supplies" quick action')
    if (!(await organizeDriveCard.first().isVisible())) throw new Error('Missing "Organize Drive" quick action')
    if (!(await nearMeCard.first().isVisible())) throw new Error('Missing "Near Me" quick action')
    console.log('✓ All 4 Quick Action cards are visible on Home')

    // Operational Attention Banner
    const attentionBanner = page.locator('text=Track your active relief coordination')
    if (!(await attentionBanner.first().isVisible())) throw new Error('Missing Operational Attention Banner ("Track your active relief coordination")')
    console.log('✓ Operational Attention Banner is visible')

    // Network Pulse Metrics
    const activeReqsMetric = page.locator('text=Active Requests')
    if (!(await activeReqsMetric.first().isVisible())) throw new Error('Missing Active Requests pulse metric')
    console.log('✓ Network Pulse metrics are visible')

    // ── 2. Bottom Navigation Tab 4 ────────────────────────────────────────────
    console.log('2. Checking Bottom Navigation Tab 4...')
    const bottomNavActivity = page.locator('nav[aria-label="Main navigation"] a:has-text("My Activity"), nav[aria-label="Main navigation"] a[aria-label="My Activity"]')
    if (!(await bottomNavActivity.first().isVisible())) {
      throw new Error('❌ BUG: Bottom navigation Tab 4 does not show "My Activity"!')
    }
    console.log('✓ Bottom navigation Tab 4 is correctly labeled "My Activity"')

    // Click Tab 4
    await bottomNavActivity.first().click()
    await page.waitForTimeout(500)
    if (!page.url().includes('/my-activity')) {
      throw new Error(`❌ BUG: Clicking Tab 4 did not navigate to /my-activity! Current URL: ${page.url()}`)
    }
    console.log('✓ Clicking Tab 4 navigated to /my-activity')

    // ── 3. My Activity Hub Tabs ───────────────────────────────────────────────
    console.log('3. Checking My Activity Hub sub-views...')
    const allTab = page.locator('button:has-text("All")').first()
    const reqTab = page.locator('button:has-text("Requests")').first()
    const donTab = page.locator('button:has-text("Donations")').first()
    const driveTab = page.locator('button:has-text("Drives")').first()

    if (!(await allTab.isVisible())) throw new Error('Missing All sub-view tab')
    if (!(await reqTab.isVisible())) throw new Error('Missing Requests sub-view tab')
    if (!(await donTab.isVisible())) throw new Error('Missing Donations sub-view tab')
    if (!(await driveTab.isVisible())) throw new Error('Missing Drives sub-view tab')
    console.log('✓ All 4 My Activity sub-views (All, Requests, Donations, Drives) are visible')

    // Test legacy redirect from /my-requests
    console.log('Testing redirect from /my-requests...')
    await page.goto(`${BASE_URL}/my-requests`, { waitUntil: 'networkidle' })
    if (!page.url().includes('/my-activity')) {
      throw new Error(`❌ BUG: /my-requests did not redirect to /my-activity! Current URL: ${page.url()}`)
    }
    console.log('✓ /my-requests cleanly redirected to /my-activity')

    // ── 4. Tracker Requester & Donor Workflow ─────────────────────────────────
    console.log('4. Checking Tracker Requester & Donor Workflow...')
    await page.goto(`${BASE_URL}/tracker/req-001`, { waitUntil: 'networkidle' })

    // Verify perspective switcher
    const requesterPerspectiveBtn = page.locator('button:has-text("Requester View")')
    const donorPerspectiveBtn = page.locator('button:has-text("Donor View")')

    if (!(await requesterPerspectiveBtn.isVisible())) throw new Error('Missing Requester View perspective button')
    if (!(await donorPerspectiveBtn.isVisible())) throw new Error('Missing Donor View perspective button')
    console.log('✓ Perspective switcher (Requester View / Donor View) is active')

    // In Requester view:
    await requesterPerspectiveBtn.click()
    await page.waitForTimeout(300)

    // Check Decline offer dialog
    const declineOfferBtn = page.locator('button:has-text("Decline Offer")').first()
    if (await declineOfferBtn.isVisible()) {
      await declineOfferBtn.click()
      await page.waitForTimeout(300)
      const declineModal = page.locator('[role="dialog"]')
      await declineModal.waitFor({ state: 'visible', timeout: 3000 })
      console.log('✓ Decline Offer modal opened')

      const reasonTextarea = declineModal.locator('textarea')
      if (!(await reasonTextarea.isVisible())) throw new Error('Decline modal missing reason textarea!')
      await reasonTextarea.fill('Duplicate offer already received from another warehouse')

      // Click Keep Offer to cancel
      const keepBtn = declineModal.locator('button:has-text("Keep Offer")')
      await keepBtn.click()
      await page.waitForTimeout(300)
      console.log('✓ Decline modal dismissed cleanly with Keep Offer')
    }

    // Switch to Donor view:
    await donorPerspectiveBtn.click()
    await page.waitForTimeout(300)

    // Check Cancel offer dialog for donor
    const cancelOfferBtn = page.locator('button:has-text("Cancel Offer")').first()
    if (await cancelOfferBtn.isVisible()) {
      await cancelOfferBtn.click()
      await page.waitForTimeout(300)
      const cancelModal = page.locator('[role="dialog"]')
      await cancelModal.waitFor({ state: 'visible', timeout: 3000 })
      console.log('✓ Cancel Offer modal opened for donor')

      const cancelReasonTextarea = cancelModal.locator('textarea')
      if (!(await cancelReasonTextarea.isVisible())) throw new Error('Cancel modal missing reason textarea!')
      await cancelReasonTextarea.fill('Supply vehicle delayed due to severe road blockage')

      const keepOfferBtn = cancelModal.locator('button:has-text("Keep Offer")')
      await keepOfferBtn.click()
      await page.waitForTimeout(300)
      console.log('✓ Cancel modal dismissed cleanly with Keep Offer')
    }

    console.log('✅ ALL MY ACTIVITY, WORKFLOW & HOME TESTS PASSED!')
  } finally {
    await browser.close()
  }
}

testMyActivityAndWorkflow().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
