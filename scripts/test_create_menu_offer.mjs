import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function testCreateMenuOfferSupplies() {
  console.log('🧪 Starting Test: Create Menu Offer Supplies Option & Flow...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. DESKTOP VIEWPORT (1280x800)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 1. Testing Create Menu on Desktop (1280x800) ---')
    const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await desktopPage.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })

    // Locate desktop "Create" button in Sidebar
    const desktopCreateBtn = desktopPage.locator('aside button:has-text("Create")')
    await desktopCreateBtn.waitFor({ state: 'visible', timeout: 5000 })
    await desktopCreateBtn.click()

    // Dialog should open
    const chooserDialog = desktopPage.locator('div[role="dialog"][aria-labelledby="create-chooser-title"]')
    await chooserDialog.waitFor({ state: 'visible', timeout: 3000 })
    console.log('✓ Create Chooser dialog opened on desktop')

    // Verify all 3 options are present
    const reqOption = chooserDialog.locator('button:has-text("Request supplies")')
    const offerOption = chooserDialog.locator('button:has-text("Offer supplies")')
    const driveOption = chooserDialog.locator('button:has-text("Start a collection drive")')

    if (!(await reqOption.isVisible())) throw new Error('Create dialog: "Request supplies" missing!')
    if (!(await offerOption.isVisible())) throw new Error('Create dialog: "Offer supplies" missing!')
    if (!(await driveOption.isVisible())) throw new Error('Create dialog: "Start a collection drive" missing!')
    console.log('✓ All 3 options (Request supplies, Offer supplies, Start a collection drive) are visible on desktop!')

    // Click "Offer supplies"
    await offerOption.click()
    await desktopPage.waitForTimeout(600)

    // Should navigate to /browse?type=requests&action=donate
    const destUrl = desktopPage.url()
    if (!destUrl.includes('/browse') || !destUrl.includes('action=donate')) {
      throw new Error(`❌ BUG: Clicking "Offer supplies" did not navigate to /browse?type=requests&action=donate! URL: ${destUrl}`)
    }
    console.log('✓ "Offer supplies" correctly navigated to Browse requests feed with donation intent')

    // Check guidance banner
    const banner = desktopPage.locator('text=Select a relief request to offer supplies')
    await banner.waitFor({ state: 'visible', timeout: 3000 })
    console.log('✓ Guidance banner "Select a relief request to offer supplies" is visible')

    // Verify "Offer Supplies" button on a request card in Browse
    const firstOfferBtn = desktopPage.locator('button:has-text("Offer Supplies")').first()
    await firstOfferBtn.waitFor({ state: 'visible', timeout: 3000 })
    console.log('✓ "Offer Supplies" action button is directly accessible on request cards')

    // Click "Offer Supplies" on the request card to open the existing MakeOfferSheet modal
    await firstOfferBtn.click()
    const offerSheet = desktopPage.locator('div[role="dialog"][aria-label="Make an offer"], h1:has-text("Offer supplies")').first()
    await offerSheet.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Existing MakeOfferSheet modal opened seamlessly from Browse')

    // Verify modal has items and quantity controls
    const qtyInput = desktopPage.locator('input[type="number"]').first()
    if (!(await qtyInput.isVisible())) throw new Error('MakeOfferSheet: quantity input missing!')
    console.log('✓ Item selection and quantity controls are active in MakeOfferSheet')

    // Close offer sheet
    const closeSheetBtn = desktopPage.locator('button[aria-label="Close"]').first()
    if (await closeSheetBtn.isVisible()) {
      await closeSheetBtn.click()
      await desktopPage.waitForTimeout(400)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. MOBILE / PWA VIEWPORT (390x844)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Testing Create Menu on Mobile / PWA (390x844) ---')
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await mobilePage.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })

    // Locate mobile elevated floating "+" Create button in BottomNav
    const mobileCreateBtn = mobilePage.locator('nav[aria-label="Main navigation"] button:has-text("Create")')
    await mobileCreateBtn.waitFor({ state: 'visible', timeout: 5000 })
    await mobileCreateBtn.click()

    // Chooser modal on mobile
    const mobileChooserDialog = mobilePage.locator('div[role="dialog"][aria-labelledby="create-chooser-title"]')
    await mobileChooserDialog.waitFor({ state: 'visible', timeout: 3000 })
    console.log('✓ Create Chooser dialog opened on mobile')

    const mobileOfferOption = mobileChooserDialog.locator('button:has-text("Offer supplies")')
    if (!(await mobileOfferOption.isVisible())) throw new Error('Mobile create dialog: "Offer supplies" missing!')
    console.log('✓ "Offer supplies" option is visible and accessible on mobile layout')

    // Click "Offer supplies" on mobile
    await mobileOfferOption.click()
    await mobilePage.waitForTimeout(600)

    const mobileDestUrl = mobilePage.url()
    if (!mobileDestUrl.includes('/browse') || !mobileDestUrl.includes('action=donate')) {
      throw new Error(`❌ BUG: Mobile "Offer supplies" did not navigate properly! URL: ${mobileDestUrl}`)
    }
    console.log('✓ Mobile navigation to Browse with donate action confirmed')

    // ═══════════════════════════════════════════════════════════════════════
    // 3. DIRECT URL /requests/:id?action=donate FLOW
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 3. Testing Direct Request Detail with ?action=donate ---')
    await mobilePage.goto(`${BASE_URL}/requests/req-001?action=donate`, { waitUntil: 'networkidle' })
    const autoOpenSheet = mobilePage.locator('div[role="dialog"][aria-label="Make an offer"], h1:has-text("Offer supplies")').first()
    await autoOpenSheet.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ /requests/req-001?action=donate automatically opens the MakeOfferSheet modal')

    console.log('\n🎉 ALL CREATE MENU & OFFER SUPPLIES TESTS PASSED!')
  } finally {
    await browser.close()
  }
}

testCreateMenuOfferSupplies().catch(err => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
