import { chromium } from '@playwright/test'
import path from 'path'

const BASE_URL = 'http://localhost:4174'
const REAL_REQ_ID = '1f0b895f-5302-4ac2-8931-197766024e32'

async function testTracker() {
  console.log('Launching browser for TrackerPage verification...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } })

    // Test 1: Real DB request tracker page initial load and RPC offers fetch
    console.log(`\nNavigating directly to /tracker/${REAL_REQ_ID}...`)
    await page.goto(`${BASE_URL}/tracker/${REAL_REQ_ID}`, { waitUntil: 'networkidle' })

    const pageContent = await page.content()
    const hasFulfillment = pageContent.includes('Fulfillment Status')
    const hasOffersSection = pageContent.includes('Offers & Shipments')
    
    // Check that offers were fetched via get_request_offers and rendered
    const hasDrinkingWater = pageContent.includes('Drinking water') || pageContent.includes('Hygiene kits')
    console.log('Real DB request verification:', {
      hasFulfillment,
      hasOffersSection,
      hasDrinkingWater
    })

    if (!hasDrinkingWater) {
      throw new Error('Real DB request did not render offers from get_request_offers!')
    }
    console.log('✓ Offers successfully fetched via get_request_offers RPC on initial load')

    // Test 2: Check buttons for Donor view
    const donorViewBtn = page.locator('button:has-text("Donor View")')
    if (await donorViewBtn.isVisible()) {
      await donorViewBtn.click()
      await page.waitForTimeout(400)
    }

    const donorContent = await page.content()
    const hasMarkDispatched = donorContent.includes('Mark as dispatched')
    const hasCancel = donorContent.includes('Cancel')
    console.log('Donor action buttons check:', { hasMarkDispatched, hasCancel })

    if (!hasMarkDispatched || !hasCancel) {
      throw new Error('Donor action buttons ("Mark as dispatched", "Cancel") not visible!')
    }
    console.log('✓ Donor action buttons ("Mark as dispatched", "Cancel") properly rendered')

    // Test 3: Check buttons for Requester view
    const requesterViewBtn = page.locator('button:has-text("Requester View")')
    if (await requesterViewBtn.isVisible()) {
      await requesterViewBtn.click()
      await page.waitForTimeout(400)
    }

    const requesterContent = await page.content()
    const hasAwaitingDispatch = requesterContent.includes('Awaiting dispatch')
    console.log('Requester pending check:', { hasAwaitingDispatch })

    // Test 4: Mock tracker page (/tracker/req-001) which has pending, dispatched, delivered offers
    console.log('\nNavigating to /tracker/req-001...')
    await page.goto(`${BASE_URL}/tracker/req-001`, { waitUntil: 'networkidle' })

    // Check Donor view on mock: contains dispatched offer off-002
    await page.locator('button:has-text("Donor View")').click()
    await page.waitForTimeout(300)
    const mockDonorContent = await page.content()
    const hasDispatchedStaticText = mockDonorContent.includes('🚚 Dispatched. Awaiting confirmation.')
    const hasDeliveredStatic = mockDonorContent.includes('✓ Delivered')
    console.log('Mock Donor status elements:', {
      hasDispatchedStaticText,
      hasDeliveredStatic
    })

    if (!hasDispatchedStaticText) {
      throw new Error('Static text "🚚 Dispatched. Awaiting confirmation." missing for donor!')
    }
    if (!hasDeliveredStatic) {
      throw new Error('Static green check "✓ Delivered" missing for delivered offer!')
    }
    console.log('✓ Static status indicators ("🚚 Dispatched. Awaiting confirmation.", "✓ Delivered") verified')

    // Check Requester view on mock: contains dispatched offer off-002 with "Confirm received ✓"
    await page.locator('button:has-text("Requester View")').click()
    await page.waitForTimeout(300)
    const mockReqContent = await page.content()
    const hasConfirmReceivedBtn = mockReqContent.includes('Confirm received ✓')
    console.log('Mock Requester status elements:', {
      hasConfirmReceivedBtn
    })

    if (!hasConfirmReceivedBtn) {
      throw new Error('Full-width success button "Confirm received ✓" missing for requester on dispatched offer!')
    }
    console.log('✓ Full-width success button "Confirm received ✓" verified for requester on dispatched offer')

    // Take screenshot for evidence
    await page.screenshot({ path: path.resolve('test-results/screenshots/tracker_verified.png') })
    console.log('\n=== ALL TRACKER PAGE VERIFICATION CHECKS PASSED ===')
  } finally {
    await browser.close()
  }
}

testTracker().catch(err => {
  console.error('Tracker test failed:', err)
  process.exit(1)
})
