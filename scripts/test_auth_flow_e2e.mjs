import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runAuthFlowTests() {
  console.log('Starting verification of Guest to Registered Auth Flow...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    // Step 1: Open Profile page directly
    console.log('\n--- 1. Testing Profile Page Guest View ---')
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })

    // Check for Guest Save data banner
    const guestBannerTitle = page.getByRole('heading', { name: 'Save your data' })
    await guestBannerTitle.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ "Save your data" banner is visible for anonymous guest')

    // Check presence of "Save my account" and "I already have an account" buttons
    const saveAccountBtn = page.getByRole('button', { name: /Save my account/i })
    const alreadyHaveAccountBtn = page.getByRole('button', { name: /I already have an account/i })
    if (!(await saveAccountBtn.isVisible())) throw new Error('Missing "Save my account" button!')
    if (!(await alreadyHaveAccountBtn.isVisible())) throw new Error('Missing "I already have an account" button!')
    console.log('✓ Both guest action buttons ("Save my account", "I already have an account") are visible')

    // Step 2: Open "Save my account" modal
    console.log('\n--- 2. Testing Save Account Modal ---')
    await saveAccountBtn.click()
    const modalTitle = page.locator('h2:has-text("Save Your Account")')
    await modalTitle.waitFor({ state: 'visible' })
    console.log('✓ "Save Your Account" modal opened')

    const emailInput = page.locator('#upgrade-email')
    const passwordInput = page.locator('#upgrade-password')
    await emailInput.fill('volunteer.test@relieflink.org')
    await passwordInput.fill('Secret1234')

    // Cancel modal test
    const cancelModalBtn = page.getByRole('button', { name: 'Cancel' })
    await cancelModalBtn.click()
    await modalTitle.waitFor({ state: 'hidden' })
    console.log('✓ Modal cancel works properly')

    // Step 3: Test "I already have an account" navigation to /login
    console.log('\n--- 3. Testing navigation to /login ---')
    await alreadyHaveAccountBtn.click()
    await page.waitForURL('**/login')
    console.log(`✓ Navigated to LoginPage: ${page.url()}`)

    // Step 4: Verify LoginPage components
    console.log('\n--- 4. Testing LoginPage Elements ---')
    const loginEmailInput = page.locator('#login-email')
    const loginPasswordInput = page.locator('#login-password')
    const signInBtn = page.getByRole('button', { name: /Sign In/i })
    const guestLink = page.getByRole('button', { name: /New here\? Use the app as a guest/i })

    if (!(await loginEmailInput.isVisible())) throw new Error('Missing login email input!')
    if (!(await loginPasswordInput.isVisible())) throw new Error('Missing login password input!')
    if (!(await signInBtn.isVisible())) throw new Error('Missing Sign In button!')
    if (!(await guestLink.isVisible())) throw new Error('Missing guest entry link!')
    console.log('✓ All login inputs and guest entry button verified')

    // Step 5: Click "New here? Use the app as a guest"
    console.log('\n--- 5. Testing Guest return to / ---')
    await guestLink.click()
    await page.waitForURL(/.*(\/|\/home)$/)
    console.log(`✓ Navigated back to home grid: ${page.url()}`)

    console.log('\nALL AUTH FLOW TESTS PASSED! 🎉')
  } catch (err) {
    console.error('Test run failed:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

runAuthFlowTests()
