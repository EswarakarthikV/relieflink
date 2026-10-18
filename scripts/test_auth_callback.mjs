import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function testAuthAndCallback() {
  console.log('🧪 Starting Test: Auth Tab Toggle, Sign-Up Feedback & Callback Handling...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

    // 1. Visit /login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    console.log('✓ Loaded /login')

    // Verify Sign In and Create Account toggle tabs
    const signInTab = page.locator('button:has-text("Sign In")').first()
    const createAccountTab = page.locator('button:has-text("Create Account")').first()

    if (!(await signInTab.isVisible())) throw new Error('Sign In tab missing!')
    if (!(await createAccountTab.isVisible())) throw new Error('Create Account tab missing!')
    console.log('✓ Both Sign In and Create Account tabs are visible')

    // 2. Click Create Account tab
    await createAccountTab.click()
    const fullNameInput = page.locator('input[id="signup-fullname"]')
    await fullNameInput.waitFor({ state: 'visible', timeout: 3000 })
    console.log('✓ Switched to Create Account tab, Full Name field is visible')

    // 3. Fill in sign-up form
    const testEmail = `volunteer-${Date.now()}@gmail.com`
    await fullNameInput.fill('Aarav Patel')
    await page.locator('input[id="login-email"]').fill(testEmail)
    await page.locator('input[id="login-password"]').fill('StrongPassword123!')

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()))

    // Submit Create Account
    const submitBtn = page.locator('button[type="submit"]:has-text("Create Account")')
    await submitBtn.click()
    console.log('✓ Submitted Create Account form')

    // 4. Verify "Check your email" confirmation screen
    try {
      const emailHeader = page.locator('h2:has-text("Check your email")')
      await emailHeader.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✓ "Check your email" header is displayed')
    } catch (e) {
      console.log('Current URL:', page.url())
      console.log('Body text on failure:\n', await page.innerText('body'))
      throw e
    }

    const pageContent = await page.innerText('body')
    if (!pageContent.includes(testEmail)) {
      throw new Error(`❌ BUG: Registered email "${testEmail}" was NOT displayed on confirmation screen!`)
    }
    console.log(`✅ PASSED: Confirmation screen explicitly displays registered email: ${testEmail}`)

    // Verify "Back to Sign In" button returns to signin
    const backBtn = page.locator('button:has-text("Back to Sign In")')
    await backBtn.click()
    await page.locator('h2:has-text("Welcome back")').waitFor({ state: 'visible', timeout: 3000 })
    console.log('✓ Back to Sign In button works and restores login form')

    // 5. Test /auth/callback route
    console.log('Testing /auth/callback route...')
    await page.goto(`${BASE_URL}/auth/callback`, { waitUntil: 'networkidle' })
    const callbackContent = await page.innerText('body')
    if (callbackContent.includes('404') || callbackContent.includes('Page Not Found')) {
      throw new Error('❌ BUG: /auth/callback rendered 404 Page Not Found!')
    }
    console.log('✓ /auth/callback loads successfully without 404')

    // 6. Test /verify-email alias
    console.log('Testing /verify-email alias...')
    await page.goto(`${BASE_URL}/verify-email`, { waitUntil: 'networkidle' })
    const verifyContent = await page.innerText('body')
    if (verifyContent.includes('404')) {
      throw new Error('❌ BUG: /verify-email rendered 404!')
    }
    console.log('✓ /verify-email loads successfully without 404')

    console.log('✅ ALL AUTH & CALLBACK TESTS PASSED!')
  } finally {
    await browser.close()
  }
}

testAuthAndCallback().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
