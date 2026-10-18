import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function testQuantityConfirmation() {
  console.log('🧪 Starting Test: Donation Commitment Quantity Confirmation (80 bottles)...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

    // 1. Navigate to request detail page for req-001 (Drinking water)
    await page.goto(`${BASE_URL}/requests/req-001`, { waitUntil: 'networkidle' })
    console.log('✓ Loaded request detail page for req-001')

    // 2. Click "Offer Supplies" button
    const offerButton = page.locator('button:has-text("Offer Supplies"), button:has-text("Make an Offer")')
    await offerButton.first().waitFor({ state: 'visible', timeout: 5000 })
    await offerButton.first().click()
    console.log('✓ Clicked Offer Supplies button')

    // 3. Wait for MakeOfferSheet modal to open
    const modal = page.locator('[role="dialog"][aria-label="Make an offer"]')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ MakeOfferSheet modal is open')

    // 4. Inspect available max quantity
    const maxChip = modal.locator('button:has-text("(Max)")')
    await maxChip.waitFor({ state: 'visible', timeout: 5000 })
    const maxChipText = await maxChip.innerText()
    console.log('Available max chip text:', maxChipText)
    const availableMax = parseInt(maxChipText, 10) || 80

    // Choose target test quantity: 80 if available, or availableMax
    const testQty = availableMax >= 80 ? 80 : availableMax
    console.log(`Setting test quantity to: ${testQty}`)

    const qtyInput = modal.locator('input[id="offer-qty-input"]')
    await qtyInput.waitFor({ state: 'visible', timeout: 5000 })
    await qtyInput.fill(String(testQty))
    console.log(`✓ Entered quantity: ${testQty}`)

    // 5. Check the confirmation checkbox
    const confirmCheckbox = modal.locator('input[type="checkbox"]')
    await confirmCheckbox.check()
    console.log('✓ Checked commitment confirmation checkbox')

    // 6. Submit the offer (button: "Submit offer")
    const submitBtn = modal.locator('button:has-text("Submit offer")')
    await submitBtn.waitFor({ state: 'visible' })
    await submitBtn.click()
    console.log('✓ Clicked Submit offer')

    // 7. Verify the success state in MakeOfferSheet
    // Must display "80 bottles", NOT 20!
    const successHeading = modal.locator('h2:has-text("Offer submitted!")')
    await successHeading.waitFor({ state: 'visible', timeout: 8000 })
    console.log('✓ Success screen displayed')

    const successContent = await modal.innerText()
    console.log('Modal text after submit:\n', successContent)

    if (successContent.includes('20 bottles') && !successContent.includes('80 bottles')) {
      throw new Error('❌ BUG DETECTED: Confirmation message displayed 20 bottles instead of 80 bottles!')
    }

    if (!successContent.includes('80 bottles') && !successContent.includes('80')) {
      throw new Error(`❌ BUG: Could not find "80" in confirmation screen! Content: ${successContent}`)
    }

    console.log('✅ PASSED: Confirmation screen correctly displayed 80 bottles (exact submitted quantity)!')

    // 8. Wait 1.5 seconds to ensure query refetching doesn't overwrite quantity
    await page.waitForTimeout(1500)
    const contentAfterRefetch = await modal.innerText()
    if (!contentAfterRefetch.includes('80')) {
      throw new Error('❌ BUG: Quantity reset to 20 after query refetch!')
    }
    console.log('✅ PASSED: Quantity remained 80 after background refetch completes!')

  } finally {
    await browser.close()
  }
}

testQuantityConfirmation().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
