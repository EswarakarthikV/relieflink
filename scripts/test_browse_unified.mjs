import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function testBrowseUnified() {
  console.log('🧪 Starting Test: Unified Browse Section & Redirects...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

    // 1. Visit /browse
    await page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' })
    console.log('✓ Loaded /browse')

    // Verify segmented control buttons exist
    const allBtn = page.locator('button:has-text("All")').first()
    const reqBtn = page.locator('button:has-text("Requests")').first()
    const donBtn = page.locator('button:has-text("Donations")').first()
    const driveBtn = page.locator('button:has-text("Drives")').first()
    const nearMeBtn = page.locator('button:has-text("Near Me")').first()

    if (!(await allBtn.isVisible())) throw new Error('Segmented control "All" missing!')
    if (!(await reqBtn.isVisible())) throw new Error('Segmented control "Requests" missing!')
    if (!(await donBtn.isVisible())) throw new Error('Segmented control "Donations" missing!')
    if (!(await driveBtn.isVisible())) throw new Error('Segmented control "Drives" missing!')
    if (!(await nearMeBtn.isVisible())) throw new Error('Segmented control "Near Me" missing!')
    console.log('✓ All 5 segmented controls (All, Requests, Donations, Drives, Near Me) are present')

    // 2. Test Donations tab
    await donBtn.click()
    await page.waitForTimeout(500)
    const donationTag = page.locator('span:has-text("DONATION OFFER")').first()
    await donationTag.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Donations tab displays DONATION OFFER cards')

    // 3. Test Drives tab
    await driveBtn.click()
    await page.waitForTimeout(500)
    const driveTag = page.locator('span:has-text("COLLECTION DRIVE")').first()
    await driveTag.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Drives tab displays COLLECTION DRIVE cards')

    // 4. Test legacy redirect from /browse-donations
    console.log('Testing redirect from /browse-donations...')
    await page.goto(`${BASE_URL}/browse-donations`, { waitUntil: 'networkidle' })
    const currentUrl = page.url()
    if (!currentUrl.includes('/browse?type=donations')) {
      throw new Error(`❌ BUG: /browse-donations did not redirect to /browse?type=donations! Current URL: ${currentUrl}`)
    }
    console.log('✓ /browse-donations cleanly redirected to /browse?type=donations')

    // 5. Test search input on All tab
    console.log('Testing search on Browse page...')
    const allTabBtn = page.locator('button:has-text("All")').first()
    await allTabBtn.click()
    await page.waitForTimeout(400)

    const searchInput = page.locator('input[id="browse-search"]')
    await searchInput.fill('Chennai')
    await page.waitForTimeout(800) // allow search filter to process
    const searchResultText = await page.innerText('body')
    if (!searchResultText.includes('Chennai')) {
      throw new Error('❌ BUG: Search for "Chennai" on All tab did not return expected match!')
    }
    console.log('✓ Search input filters results seamlessly across drives and requests')

    console.log('✅ ALL UNIFIED BROWSE TESTS PASSED!')
  } finally {
    await browser.close()
  }
}

testBrowseUnified().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
