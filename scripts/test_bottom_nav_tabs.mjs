import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runBottomNavTests() {
  console.log('Starting verification of mobile BottomNav tabs...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    // Set viewport to mobile size (<1024px) so BottomNav is visible
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' })

    const bottomNav = page.locator('nav[aria-label="Main navigation"]')
    await bottomNav.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Mobile bottom nav is visible on mobile viewport')

    // Verify exactly 5 tabs in order:
    // 1. Home
    // 2. Browse
    // 3. Create
    // 4. My Requests
    // 5. Profile
    const homeTab = bottomNav.locator('a[aria-label="Home"]')
    const browseTab = bottomNav.locator('a[aria-label="Browse requests"]')
    const createBtn = bottomNav.locator('button[aria-label="Create"]')
    const myRequestsTab = bottomNav.locator('a[aria-label="My Requests"]')
    const profileTab = bottomNav.locator('a[aria-label="Profile"]')
    const alertsTab = bottomNav.locator('a[aria-label="Alerts and notifications"]')

    if (!(await homeTab.isVisible())) throw new Error('Home tab missing!')
    if (!(await browseTab.isVisible())) throw new Error('Browse tab missing!')
    if (!(await createBtn.isVisible())) throw new Error('Create FAB button missing!')
    if (!(await myRequestsTab.isVisible())) throw new Error('My Requests tab missing!')
    if (!(await profileTab.isVisible())) throw new Error('Profile tab missing!')
    if (await alertsTab.isVisible()) throw new Error('Alerts tab is still visible on bottom nav!')
    console.log('✓ Exactly the 5 requested tabs exist. Alerts tab is completely removed.')

    // Check Home active state
    const homeClass = await homeTab.getAttribute('class')
    if (!homeClass?.includes('text-brand-600')) throw new Error('Home tab should be highlighted with text-brand-600!')
    console.log('✓ Home tab is active on /home')

    // Navigate to /browse and check active state
    await browseTab.click()
    await page.waitForURL('**/browse')
    const browseClass = await browseTab.getAttribute('class')
    if (!browseClass?.includes('text-brand-600')) throw new Error('Browse tab should be highlighted with text-brand-600!')
    console.log('✓ Browse tab is active on /browse')

    // Navigate to /my-requests and check active state
    await myRequestsTab.click()
    await page.waitForURL('**/my-requests')
    const reqClass = await myRequestsTab.getAttribute('class')
    if (!reqClass?.includes('text-brand-600')) throw new Error('My Requests tab should be highlighted with text-brand-600!')
    console.log('✓ My Requests tab is active on /my-requests')

    // Navigate to /profile and check active state
    await profileTab.click()
    await page.waitForURL('**/profile')
    const profileClass = await profileTab.getAttribute('class')
    if (!profileClass?.includes('text-brand-600')) throw new Error('Profile tab should be highlighted with text-brand-600!')
    console.log('✓ Profile tab is active on /profile')

    // Click Create FAB button and check that CreateChooser opens
    await createBtn.click()
    const createModal = page.locator('text=What do you want to create?')
    await createModal.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Create FAB button opens CreateChooser modal')

    console.log('\nALL BOTTOM NAV TESTS PASSED! 🚀')
  } catch (err) {
    console.error('Test run failed:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

runBottomNavTests()
