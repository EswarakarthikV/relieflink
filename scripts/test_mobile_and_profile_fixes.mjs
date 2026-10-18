import { chromium } from '@playwright/test'
import { spawn } from 'child_process'

const PORT = 4180
const BASE_URL = `http://localhost:${PORT}`

async function runTests() {
  console.log('🚀 Starting Verification: Mobile UI & Profile Location Fixes...')

  // Start Vite preview on PORT
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  })

  // Wait for server ready
  await new Promise((resolve) => setTimeout(resolve, 3000))

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 1: MOBILE VIEW - MAKE AN OFFER SUBMIT BUTTON
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- 1. Testing Mobile View: Make an Offer Submit Button ---')
    // Emulate iPhone SE / Mobile viewport
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    })
    const mobilePage = await mobileContext.newPage()

    await mobilePage.goto(`${BASE_URL}/requests/req-001`, { waitUntil: 'networkidle' })

    const makeOfferBtn = mobilePage.locator('button:has-text("Make an Offer")')
    await makeOfferBtn.waitFor({ state: 'visible', timeout: 5000 })
    await makeOfferBtn.click()

    // Verify modal sheet is open and has high z-index above bottom nav
    const sheet = mobilePage.locator('div[role="dialog"][aria-label="Make an offer"]')
    await sheet.waitFor({ state: 'visible', timeout: 5000 })
    
    // Check z-index
    const zIndex = await sheet.evaluate((el) => window.getComputedStyle(el).zIndex)
    console.log(`✓ Sheet z-index: ${zIndex} (higher than BottomNav z-50)`)
    if (parseInt(zIndex, 10) < 60) {
      throw new Error(`Sheet z-index is too low: ${zIndex}`)
    }

    // Verify Submit button is visible and within the mobile viewport
    const submitBtn = mobilePage.locator('button:has-text("Submit offer")')
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 })

    const submitBox = await submitBtn.boundingBox()
    if (!submitBox) throw new Error('Submit button has no bounding box')
    console.log(`✓ Submit button bounding box: y=${Math.round(submitBox.y)}, height=${Math.round(submitBox.height)}`)

    if (submitBox.y + submitBox.height > 667) {
      throw new Error(`Submit button exceeds viewport height (y=${submitBox.y + submitBox.height} > 667)`)
    }
    console.log('✓ Submit button is fully within mobile viewport (not pushed off screen)')

    // Verify bottom actions container is sticky/visible above safe area
    const cancelBtn = mobilePage.locator('button:has-text("Cancel")').first()
    await cancelBtn.waitFor({ state: 'visible' })
    await cancelBtn.click()
    await mobilePage.waitForTimeout(400)
    await mobileContext.close()

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 2: PROFILE LOCATION EDITABLE & PERSISTENCE
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Testing Profile Location: Not Hardcoded to Pune, Editable & Persistent ---')
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await desktopContext.newPage()

    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })

    // Check location value in info card does NOT default to Pune
    const locationInfoText = await page.locator('text=Location').locator('..').locator('p.text-body').innerText()
    console.log(`Initial profile location displayed: "${locationInfoText}"`)
    if (locationInfoText.toLowerCase().includes('pune')) {
      throw new Error(`Location is still hardcoded to Pune: "${locationInfoText}"`)
    }
    console.log('✓ Verified: Profile location does not default to Pune')

    // Test editing location
    const locationInput = page.locator('input#profile-location-input')
    await locationInput.waitFor({ state: 'visible' })
    await locationInput.fill('Chennai, Tamil Nadu')

    const saveLocBtn = page.locator('button:has-text("Save Location")')
    await saveLocBtn.click()

    // Check saved indicator
    await page.locator('text=Saved!').first().waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Verified: Save Location triggered successfully with "Saved!" feedback')

    // Verify updated value in Info Card
    const updatedLocationText = await page.locator('text=Location').locator('..').locator('p.text-body').innerText()
    console.log(`✓ Updated location text in info card: "${updatedLocationText}"`)
    if (!updatedLocationText.includes('Chennai')) {
      throw new Error(`Updated location does not reflect in Info card: "${updatedLocationText}"`)
    }

    // Verify persistence across page reload
    await page.reload({ waitUntil: 'networkidle' })
    const reloadedLocationText = await page.locator('text=Location').locator('..').locator('p.text-body').innerText()
    console.log(`✓ Reloaded profile location: "${reloadedLocationText}"`)
    if (!reloadedLocationText.includes('Chennai')) {
      throw new Error(`Saved location did not persist on reload: "${reloadedLocationText}"`)
    }
    console.log('✓ Verified: Location persists across page reload')

    // Test map picker modal opening
    const mapPickerBtn = page.locator('button:has-text("Choose on map")')
    await mapPickerBtn.click()
    const mapModal = page.locator('text=Pick on map').first()
    await mapModal.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Verified: Choose on map opens LocationPickerModal successfully')
    const closeMapBtn = page.locator('button[aria-label="Close"], button:has-text("Cancel")').first()
    await closeMapBtn.click()
    await page.waitForTimeout(400)

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 3: DRIVE DETAIL PAGE "CONTRIBUTE SUPPLIES TO THIS DRIVE" BUTTON
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- 3. Testing Drive Detail: Contribute Supplies Button Alignment ---')
    await page.goto(`${BASE_URL}/drives/drive-001`, { waitUntil: 'networkidle' })

    const contributeBtn = page.locator('button:has-text("Contribute supplies to this drive")').first()
    await contributeBtn.waitFor({ state: 'visible', timeout: 5000 })

    // Check layout and icon alignment
    const btnBox = await contributeBtn.boundingBox()
    const svgIcon = contributeBtn.locator('svg').first()
    const iconBox = await svgIcon.boundingBox()
    const labelSpan = contributeBtn.locator('span:has-text("Contribute supplies")').first()
    const labelBox = await labelSpan.boundingBox()

    console.log(`Button height: ${Math.round(btnBox.height)}px`)
    console.log(`Icon center Y: ${Math.round(iconBox.y + iconBox.height / 2)}px, Label center Y: ${Math.round(labelBox.y + labelBox.height / 2)}px`)

    // Icon and text should be vertically aligned within 4px of each other
    const diffY = Math.abs((iconBox.y + iconBox.height / 2) - (labelBox.y + labelBox.height / 2))
    if (diffY > 4) {
      throw new Error(`Icon and text are vertically misaligned by ${diffY}px`)
    }
    console.log(`✓ Icon and text are vertically centered together (Y diff: ${diffY.toFixed(1)}px)`)

    // Icon should be to the left of the label (horizontal layout)
    if (iconBox.x >= labelBox.x) {
      throw new Error(`Icon (x=${iconBox.x}) is not to the left of label (x=${labelBox.x})`)
    }
    console.log('✓ Verified: Box icon and label are horizontally aligned (no multi-line break)')

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST 4: DASHBOARD "VIEW ACTIVITY" BUTTON
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n--- 4. Testing Dashboard: View Activity Button Centering ---')
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })

    const viewActBtn = page.locator('a[href="/my-activity"] button').first()
    await viewActBtn.waitFor({ state: 'visible', timeout: 5000 })

    const viewActBox = await viewActBtn.boundingBox()
    const viewActText = await viewActBtn.innerText()
    console.log(`View Activity button text: "${viewActText.trim()}" (width=${Math.round(viewActBox.width)}px, height=${Math.round(viewActBox.height)}px)`)

    const arrowIcon = viewActBtn.locator('svg').first()
    const arrowBox = await arrowIcon.boundingBox()
    const textSpan = viewActBtn.locator('span:has-text("View Activity")').first()
    const textBox = await textSpan.boundingBox()

    const actDiffY = Math.abs((textBox.y + textBox.height / 2) - (arrowBox.y + arrowBox.height / 2))
    if (actDiffY > 4) {
      throw new Error(`View Activity label and arrow icon are misaligned by ${actDiffY}px`)
    }
    console.log(`✓ View Activity label and arrow icon are centered together (Y diff: ${actDiffY.toFixed(1)}px)`)

    // Test mobile rendering of View Activity button
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)
    const mobileViewActBox = await viewActBtn.boundingBox()
    console.log(`✓ Mobile View Activity button: width=${Math.round(mobileViewActBox.width)}px, height=${Math.round(mobileViewActBox.height)}px`)

    // Test clicking navigation destination
    await viewActBtn.click()
    await page.waitForURL('**/my-activity', { timeout: 5000 })
    console.log('✓ Verified: View Activity button navigates correctly to /my-activity')

    console.log('\n======================================================================')
    console.log('🎉 ALL 4 MOBILE UI & PROFILE LOCATION FIXES VERIFIED SUCCESSFULLY!')
    console.log('======================================================================')
  } finally {
    await browser.close()
    previewProcess.kill()
  }
}

runTests().catch((err) => {
  console.error('\n❌ Verification failed:', err)
  process.exit(1)
})
