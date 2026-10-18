import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runNavigationAudit() {
  console.log('🧪 Starting Test: Navigation Tabs & My Activity Label Audit...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. DESKTOP NAVIGATION (1280x800)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 1. Testing Desktop Navigation (1280x800) ---')
    const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await desktopPage.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })

    const sidebar = desktopPage.locator('aside[aria-label="Desktop navigation"]')
    await sidebar.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Desktop sidebar is visible')

    // Check allowed tabs
    const homeNav = sidebar.locator('a:has-text("Home")')
    const browseNav = sidebar.locator('a:has-text("Browse")')
    const activityNav = sidebar.locator('a:has-text("My Activity")')
    const createNav = sidebar.locator('button:has-text("Create")')
    const profileNav = sidebar.locator('a:has-text("Profile")')

    if (!(await homeNav.isVisible())) throw new Error('Desktop Sidebar: "Home" tab missing!')
    if (!(await browseNav.isVisible())) throw new Error('Desktop Sidebar: "Browse" tab missing!')
    if (!(await activityNav.isVisible())) throw new Error('Desktop Sidebar: "My Activity" tab missing!')
    if (!(await createNav.isVisible())) throw new Error('Desktop Sidebar: "Create" button missing!')
    if (!(await profileNav.isVisible())) throw new Error('Desktop Sidebar: "Profile" tab missing!')
    console.log('✓ Desktop Sidebar contains: Home, Browse, My Activity, Create, Profile')

    // Check removed tabs are ABSENT
    const drivesNav = sidebar.locator('a:has-text("Drives")')
    const donationsNav = sidebar.locator('a:has-text("Donations")')
    const legacyRequestsNav = sidebar.locator('a:has-text("My Requests")')

    if (await drivesNav.count() > 0) throw new Error('Desktop Sidebar: separate "Drives" tab still exists!')
    if (await donationsNav.count() > 0) throw new Error('Desktop Sidebar: separate "Donations" tab still exists!')
    if (await legacyRequestsNav.count() > 0) throw new Error('Desktop Sidebar: "My Requests" label still exists instead of "My Activity"!')
    console.log('✓ Desktop Sidebar: standalone Drives and Donations tabs successfully removed, My Requests replaced by My Activity')

    // ═══════════════════════════════════════════════════════════════════════
    // 2. MOBILE NAVIGATION (390x844)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 2. Testing Mobile Navigation (390x844) ---')
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await mobilePage.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })

    const bottomNav = mobilePage.locator('nav[aria-label="Main navigation"]')
    await bottomNav.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Mobile bottom navigation is visible')

    const mobileHome = bottomNav.locator('a:has-text("Home")')
    const mobileBrowse = bottomNav.locator('a:has-text("Browse")')
    const mobileCreate = bottomNav.locator('button:has-text("Create")')
    const mobileActivity = bottomNav.locator('a:has-text("My Activity")')
    const mobileProfile = bottomNav.locator('a:has-text("Profile")')

    if (!(await mobileHome.isVisible())) throw new Error('Mobile BottomNav: "Home" tab missing!')
    if (!(await mobileBrowse.isVisible())) throw new Error('Mobile BottomNav: "Browse" tab missing!')
    if (!(await mobileCreate.isVisible())) throw new Error('Mobile BottomNav: "Create" button missing!')
    if (!(await mobileActivity.isVisible())) throw new Error('Mobile BottomNav: "My Activity" tab missing!')
    if (!(await mobileProfile.isVisible())) throw new Error('Mobile BottomNav: "Profile" tab missing!')
    console.log('✓ Mobile BottomNav contains: Home, Browse, Create, My Activity, Profile')

    const mobileDrives = bottomNav.locator('a:has-text("Drives")')
    const mobileDonations = bottomNav.locator('a:has-text("Donations")')
    const mobileLegacyRequests = bottomNav.locator('a:has-text("My Requests")')

    if (await mobileDrives.count() > 0) throw new Error('Mobile BottomNav: separate "Drives" tab still exists!')
    if (await mobileDonations.count() > 0) throw new Error('Mobile BottomNav: separate "Donations" tab still exists!')
    if (await mobileLegacyRequests.count() > 0) throw new Error('Mobile BottomNav: "My Requests" label still exists instead of "My Activity"!')
    console.log('✓ Mobile BottomNav: no duplicate or separate Drives/Donations tabs, My Activity label confirmed')

    // ═══════════════════════════════════════════════════════════════════════
    // 3. BROWSE SECTION FILTERS & DATA DISPLAY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 3. Testing Browse Section Filters ---')
    await mobilePage.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' })

    const allBtn = mobilePage.locator('button:has-text("All")').first()
    const reqBtn = mobilePage.locator('button:has-text("Requests")').first()
    const donBtn = mobilePage.locator('button:has-text("Donations")').first()
    const driveBtn = mobilePage.locator('button:has-text("Drives")').first()
    const nearMeBtn = mobilePage.locator('button:has-text("Near Me")').first()

    if (!(await allBtn.isVisible())) throw new Error('Browse: "All" filter missing!')
    if (!(await reqBtn.isVisible())) throw new Error('Browse: "Requests" filter missing!')
    if (!(await donBtn.isVisible())) throw new Error('Browse: "Donations" filter missing!')
    if (!(await driveBtn.isVisible())) throw new Error('Browse: "Drives" filter missing!')
    if (!(await nearMeBtn.isVisible())) throw new Error('Browse: "Near Me" filter missing!')
    console.log('✓ Browse has all 5 required filters: All, Requests, Donations, Drives, Near Me')

    // Click Requests
    await reqBtn.click()
    await mobilePage.waitForTimeout(400)
    const requestItem = mobilePage.locator('text=Drinking water for 200 families').first()
    if (!(await requestItem.isVisible())) throw new Error('Browse: Requests filter did not display expected requests!')
    console.log('✓ Requests filter correctly displays relief requests')

    // Click Donations
    await donBtn.click()
    await mobilePage.waitForTimeout(400)
    const donationItem = mobilePage.locator('span:has-text("DONATION OFFER")').first()
    if (!(await donationItem.isVisible())) throw new Error('Browse: Donations filter did not display expected donations!')
    console.log('✓ Donations filter correctly displays donation commitments')

    // Click Drives
    await driveBtn.click()
    await mobilePage.waitForTimeout(400)
    const driveItem = mobilePage.locator('span:has-text("COLLECTION DRIVE")').first()
    if (!(await driveItem.isVisible())) throw new Error('Browse: Drives filter did not display expected collection drives!')
    console.log('✓ Drives filter correctly displays collection drives')

    // ═══════════════════════════════════════════════════════════════════════
    // 4. BACKWARD COMPATIBLE REDIRECTS & MY ACTIVITY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- 4. Testing Backward-Compatible Redirects & My Activity ---')
    await mobilePage.goto(`${BASE_URL}/my-requests`, { waitUntil: 'networkidle' })
    const urlAfterRequests = mobilePage.url()
    if (!urlAfterRequests.includes('/my-activity')) {
      throw new Error(`❌ /my-requests did not redirect to /my-activity! URL: ${urlAfterRequests}`)
    }
    console.log('✓ /my-requests cleanly redirects to /my-activity')

    const activityTitle = mobilePage.locator('h1:has-text("My Activity")').first()
    if (!(await activityTitle.isVisible())) throw new Error('My Activity page title is missing!')
    console.log('✓ My Activity page loads and displays user activity')

    await mobilePage.goto(`${BASE_URL}/browse-donations`, { waitUntil: 'networkidle' })
    const urlAfterDonations = mobilePage.url()
    if (!urlAfterDonations.includes('/browse?type=donations')) {
      throw new Error(`❌ /browse-donations did not redirect to /browse?type=donations! URL: ${urlAfterDonations}`)
    }
    console.log('✓ /browse-donations cleanly redirects to /browse?type=donations')

    console.log('\n🎉 ALL NAVIGATION & AUDIT CHECKS PASSED SUCCESSFULLY!')
  } finally {
    await browser.close()
  }
}

runNavigationAudit().catch(err => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
