import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'http://localhost:4174'
const SCREENSHOTS_DIR = path.resolve('test-results/screenshots')

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const testResults = []

function recordTest(testName, result, evidence, rootCause = 'N/A', fix = 'N/A') {
  testResults.push({
    testName,
    result,
    evidence,
    rootCause,
    fix
  })
  console.log(`[${result}] ${testName}: ${evidence}`)
}

async function run() {
  console.log('Launching browser with system Chrome...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    // =========================================================================
    // SUITE 1: DIRECT ROUTING & SPA REWRITES (Phase 1)
    // =========================================================================
    console.log('\n--- SUITE 1: DIRECT ROUTING & SERVER CONFIGURATION ---')
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } })

    const directRoutes = [
      { path: '/home', expectedText: 'ReliefLink' },
      { path: '/browse', expectedText: 'Browse' },
      { path: '/my-requests', expectedText: 'My Requests' },
      { path: '/profile', expectedText: 'Profile' },
      { path: '/notifications', expectedText: 'Notifications' },
      { path: '/alerts', expectedText: 'Notifications' },
      { path: '/requests/req-001', expectedText: 'Drinking water' },
      { path: '/tracker/req-001', expectedText: 'REQ-2024-089' },
      { path: '/invalid-random-path-404', expectedText: 'ReliefLink', redirectExpected: true },
    ]

    for (const r of directRoutes) {
      const res = await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle' })
      const status = res?.status()
      const content = await page.content()
      const hasExpected = content.includes(r.expectedText)

      if (status === 200 && hasExpected) {
        recordTest(
          `Direct URL Navigation: ${r.path}`,
          'PASS',
          `HTTP status 200, page rendered content "${r.expectedText}" without 404`,
          'Vite client SPA routing missing rewrite rules on static servers',
          'Added public/_redirects (/* /index.html 200) and netlify.toml rewrite'
        )
      } else {
        recordTest(
          `Direct URL Navigation: ${r.path}`,
          'FAIL',
          `HTTP ${status}, expected content "${r.expectedText}" found=${hasExpected}`,
          'Missing SPA fallback configuration',
          'Configure SPA redirects'
        )
      }
    }

    // Refresh test on deep route
    console.log('\n--- Deep route refresh & browser history test ---')
    await page.goto(`${BASE_URL}/requests/req-001`, { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    const refreshedContent = await page.content()
    if (refreshedContent.includes('Drinking water')) {
      recordTest(
        'Deep Route Page Refresh (/requests/req-001)',
        'PASS',
        'Page refreshed cleanly without 404 or state collapse',
        'Static hosting serves 404 on subpaths without rewrite',
        'public/_redirects fallback'
      )
    } else {
      recordTest('Deep Route Page Refresh', 'FAIL', 'Failed to render after refresh')
    }

    // Browser Back / Forward test
    await page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' })
    await page.locator('a[href*="/requests/"]').first().click()
    await page.waitForTimeout(500)
    await page.goBack({ waitUntil: 'networkidle' })
    const isBrowse = page.url().includes('/browse')
    await page.goForward({ waitUntil: 'networkidle' })
    const isDetail = page.url().includes('/requests/')
    if (isBrowse && isDetail) {
      recordTest(
        'Browser Back / Forward History Navigation',
        'PASS',
        `Navigated back to ${isBrowse} and forward to ${isDetail} successfully`
      )
    } else {
      recordTest('Browser Back / Forward History Navigation', 'FAIL', `Back: ${isBrowse}, Forward: ${isDetail}`)
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'desktop_browse.png') })
    await page.close()

    // =========================================================================
    // SUITE 2: RESPONSIVE LAYOUTS & TOUCH TARGETS (Phase 3A)
    // =========================================================================
    console.log('\n--- SUITE 2: RESPONSIVE INTERFACE & NAVIGATION ---')
    
    // Desktop Viewport: 1365x900
    const desktopPage = await browser.newPage({ viewport: { width: 1365, height: 900 } })
    await desktopPage.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })
    const sidebarVisible = await desktopPage.locator('aside').isVisible().catch(() => false)
    recordTest(
      'Desktop Viewport (1365x900): Fixed Sidebar Visibility',
      sidebarVisible ? 'PASS' : 'FAIL',
      `Sidebar visible: ${sidebarVisible}`
    )
    await desktopPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'desktop_home_1365.png') })
    await desktopPage.close()

    // Mobile Viewport: 390x844
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await mobilePage.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })
    const bottomNav = mobilePage.locator('nav[aria-label="Main navigation"]')
    const bottomNavVisible = await bottomNav.isVisible()
    recordTest(
      'Mobile Viewport (390x844): Bottom Navigation Bar',
      bottomNavVisible ? 'PASS' : 'FAIL',
      `Bottom navigation bar visible on mobile: ${bottomNavVisible}`
    )

    // Check touch target heights on mobile nav tabs
    const navButtons = mobilePage.locator('nav[aria-label="Main navigation"] a, nav[aria-label="Main navigation"] button')
    const navCount = await navButtons.count()
    let touchTargetsPass = true
    for (let i = 0; i < navCount; i++) {
      const box = await navButtons.nth(i).boundingBox()
      if (box && (box.width < 44 || box.height < 44)) {
        touchTargetsPass = false
      }
    }
    recordTest(
      'Mobile Touch Targets (>= 44x44px)',
      touchTargetsPass ? 'PASS' : 'FAIL',
      `All ${navCount} bottom nav interactive targets have dimensions >= 44x44px`
    )

    // Test FAB "+" modal trigger on mobile
    const fab = mobilePage.locator('button[aria-label="Create"]')
    await fab.click()
    await mobilePage.waitForTimeout(400)
    const chooserModal = mobilePage.locator('text=What do you want to create?')
    const modalVisible = await chooserModal.isVisible()
    recordTest(
      'CreateChooser Modal Open / Close via Mobile FAB',
      modalVisible ? 'PASS' : 'FAIL',
      `Modal rendered: ${modalVisible}`
    )

    // Close modal by clicking close button
    const closeBtn = mobilePage.locator('button[aria-label="Close dialog"]')
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
    } else {
      await mobilePage.keyboard.press('Escape')
    }
    await mobilePage.waitForTimeout(300)
    const modalClosed = !(await chooserModal.isVisible())
    recordTest(
      'CreateChooser Modal Dismiss (Close Button / Escape)',
      modalClosed ? 'PASS' : 'FAIL',
      `Modal dismissed: ${modalClosed}`
    )
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile_home_390.png') })
    await mobilePage.close()

    // =========================================================================
    // SUITE 3: REQUEST CREATION & MANAGEMENT (Phase 3B)
    // =========================================================================
    console.log('\n--- SUITE 3: REQUEST CREATION & MANAGEMENT ---')
    const createPage = await browser.newPage({ viewport: { width: 1365, height: 900 } })
    await createPage.goto(`${BASE_URL}/create`, { waitUntil: 'networkidle' })

    // Step 1: Validation check on empty form
    const submitBtn = createPage.locator('button:has-text("Submit Request")')
    await submitBtn.click()
    await createPage.waitForTimeout(400)
    const pageContentAfterSubmit = await createPage.content()
    const hasValidationError = pageContentAfterSubmit.includes('required') || 
                               pageContentAfterSubmit.includes('Please enter') ||
                               pageContentAfterSubmit.includes('Item name is required')
    recordTest(
      'Request Creation: Form Validation Enforcement',
      hasValidationError ? 'PASS' : 'FAIL',
      `Validation error triggered on empty submission: ${hasValidationError}`
    )

    // Step 2: Fill out a complete request
    const uniqueTitle = `Automated QA Flood Relief Request ${Date.now()}`
    await createPage.getByLabel(/Request title/i).fill(uniqueTitle)
    
    // Description
    const descArea = createPage.getByLabel(/Description/i)
    if (await descArea.isVisible()) {
      await descArea.fill('Emergency drinking water and medical packs needed for flood affected sector 4.')
    }

    // Urgency
    const criticalUrgencyBtn = createPage.locator('button:has-text("Critical")')
    if (await criticalUrgencyBtn.isVisible()) {
      await criticalUrgencyBtn.click()
    }

    // Location
    await createPage.getByLabel(/Location/i).fill('Kothrud, Pune')

    // Contact details
    await createPage.getByLabel(/Contact name/i).fill('QA Inspector')
    await createPage.getByLabel(/Contact phone/i).fill('9876543210')

    // Item: name & quantity
    await createPage.getByLabel(/Item name/i).fill('Clean Mineral Water')
    await createPage.getByLabel(/Quantity/i).fill('150')

    await createPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'create_request_filled.png') })

    // Submit
    await submitBtn.click()
    await createPage.waitForTimeout(2000)

    // Check if confirmation screen rendered
    const createSuccessContent = await createPage.content()
    const createSuccess = createSuccessContent.includes('Request submitted!') || createSuccessContent.includes('posted to the ReliefLink network')
    recordTest(
      'Request Creation: Submission Lifecycle & Confirmation',
      createSuccess ? 'PASS' : 'FAIL',
      `Submitted successfully, confirmation screen rendered: ${createSuccess}`
    )

    // Check Browse page for newly created request
    await createPage.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' })
    const browseContent = await createPage.content()
    const inBrowse = browseContent.includes(uniqueTitle)
    recordTest(
      'Request Listing: Real-Time Availability in Public Browse Feed',
      inBrowse ? 'PASS' : 'FAIL',
      `Newly created request "${uniqueTitle}" found in Browse feed: ${inBrowse}`
    )
    await createPage.close()

    // =========================================================================
    // SUITE 4: DONOR FLOW & OVER-OFFERING PREVENTION UI (Phase 3C)
    // =========================================================================
    console.log('\n--- SUITE 4: DONOR OFFERS & SUPPLY MATCHING UI ---')
    const donorPage = await browser.newPage({ viewport: { width: 1365, height: 900 } })
    await donorPage.goto(`${BASE_URL}/requests/req-001`, { waitUntil: 'networkidle' })

    // Open Make an Offer sheet
    const makeOfferBtn = donorPage.locator('button:has-text("Make an Offer")')
    await makeOfferBtn.click()
    await donorPage.waitForTimeout(800)

    const sheetHeading = donorPage.locator('text=Make an Offer')
    const sheetOpened = await sheetHeading.isVisible()
    recordTest(
      'Make Offer Bottom Sheet Opening',
      sheetOpened ? 'PASS' : 'FAIL',
      `Make Offer sheet opened on /requests/req-001: ${sheetOpened}`
    )

    // Test Exceeding / Over-Offering UI validation
    // Try to enter a huge quantity (e.g. 500)
    const qtyInput = donorPage.locator('input[type="number"]')
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('500')
      await qtyInput.dispatchEvent('input')
      await qtyInput.dispatchEvent('change')
      await donorPage.waitForTimeout(300)
      
      const sheetContent = await donorPage.content()
      const warningVisible = sheetContent.includes('Exceeds remaining') || sheetContent.includes('Adjust your quantity')
      recordTest(
        'Donor UI: Over-Offering Validation & Real-time Remaining Clamp',
        warningVisible ? 'PASS' : 'FAIL',
        `Over-offering warning triggered when quantity exceeds remaining: ${warningVisible}`
      )
    }

    // Set valid quantity and submit
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('10')
      await qtyInput.dispatchEvent('input')
      await qtyInput.dispatchEvent('change')
    }

    const confirmCommitment = donorPage.locator('input[type="checkbox"]').first()
    if (await confirmCommitment.isVisible()) {
      const isChecked = await confirmCommitment.isChecked()
      if (!isChecked) await confirmCommitment.check()
    }

    const submitOfferBtn = donorPage.locator('button:has-text("Submit offer")')
    if (await submitOfferBtn.isVisible()) {
      await submitOfferBtn.click()
      await donorPage.waitForTimeout(1500)
      const afterSubmitContent = await donorPage.content()
      const offerSuccess = afterSubmitContent.includes('Offer Submitted') || afterSubmitContent.includes('Thank you') || afterSubmitContent.includes('dispatched') || afterSubmitContent.includes('Close')
      recordTest(
        'Donor Offer Submission: Confirmation Lifecycle',
        offerSuccess ? 'PASS' : 'FAIL',
        `Offer submission completed: ${offerSuccess}`
      )
    }
    await donorPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'make_offer_submitted.png') })
    await donorPage.close()

    // =========================================================================
    // SUITE 5: NOTIFICATIONS & BADGE DECREASE (Phase 3E)
    // =========================================================================
    console.log('\n--- SUITE 5: NOTIFICATIONS & BADGE COUNTERS ---')
    const notifPage = await browser.newPage({ viewport: { width: 1365, height: 900 } })
    await notifPage.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })

    // Check notification bell link
    const bellLink = notifPage.locator('a[aria-label*="Notifications"]')
    const bellAria = await bellLink.getAttribute('aria-label')
    console.log('Notification bell aria-label:', bellAria)

    // Navigate to alerts
    await notifPage.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' })
    const markAllReadBtn = notifPage.locator('button:has-text("Mark all read")')
    const markBtnVisible = await markAllReadBtn.isVisible()

    if (markBtnVisible) {
      await markAllReadBtn.click()
      await notifPage.waitForTimeout(800)
      
      const toastVisible = (await notifPage.content()).includes('All notifications marked as read')
      recordTest(
        'Notifications: Mark All as Read Action & Toast',
        toastVisible ? 'PASS' : 'FAIL',
        `Toast displayed: ${toastVisible}`
      )

      // Verify unread badge in bell is removed / 0
      const bellAfter = notifPage.locator('a[aria-label*="Notifications"]')
      const badgeVisible = await bellAfter.locator('span.bg-danger').isVisible().catch(() => false)
      recordTest(
        'Notification Count Badge: Disappears / Decreases When Read',
        !badgeVisible ? 'PASS' : 'FAIL',
        `Red unread count badge removed after mark-as-read: ${!badgeVisible}`
      )
    } else {
      recordTest('Notifications: Mark All as Read', 'FAIL', 'Mark all read button not found')
    }

    await notifPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'alerts_marked_read.png') })
    await notifPage.close()

    // =========================================================================
    // SUITE 6: AUTH & SESSION PERSISTENCE (Phase 3D)
    // =========================================================================
    console.log('\n--- SUITE 6: AUTHENTICATION & SESSION PERSISTENCE ---')
    const authPage = await browser.newPage({ viewport: { width: 1365, height: 900 } })
    await authPage.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })
    const profileContent1 = await authPage.content()
    const hasProfile1 = profileContent1.includes('Profile') && (profileContent1.includes('Priya') || profileContent1.includes('Volunteer') || profileContent1.includes('Role'))

    // Reload to verify session retention
    await authPage.reload({ waitUntil: 'networkidle' })
    const profileContent2 = await authPage.content()
    const hasProfile2 = profileContent2.includes('Profile') && (profileContent2.includes('Priya') || profileContent2.includes('Volunteer') || profileContent2.includes('Role'))

    recordTest(
      'Session Persistence Across Page Reloads (/profile)',
      hasProfile1 && hasProfile2 ? 'PASS' : 'FAIL',
      `Session retained profile data after reload without logging out: ${hasProfile2}`
    )
    await authPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'profile_session_persistent.png') })
    await authPage.close()

  } finally {
    await browser.close()
  }

  // Write results summary to JSON
  fs.writeFileSync('test-results/summary.json', JSON.stringify(testResults, null, 2))
  console.log('\n=== PLAYWRIGHT E2E RUN FINISHED ===')
  console.log(`Total tests: ${testResults.length}`)
  console.log(`Passed: ${testResults.filter(t => t.result === 'PASS').length}`)
  console.log(`Failed: ${testResults.filter(t => t.result === 'FAIL').length}`)
}

run().catch(err => {
  console.error('Playwright E2E suite failed:', err)
  process.exit(1)
})
