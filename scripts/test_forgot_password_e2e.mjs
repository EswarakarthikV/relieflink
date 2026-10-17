import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runForgotPasswordFlowTests() {
  console.log('Starting verification of Forgot Password flow...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    // Step 1: Open /login and check for "Forgot password?" link
    console.log('\n--- 1. Testing Forgot Password link on /login ---')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })

    const forgotLink = page.getByRole('link', { name: /Forgot password\?/i })
    await forgotLink.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ "Forgot password?" link is visible on /login')

    // Click "Forgot password?" link
    await forgotLink.click()
    await page.waitForURL('**/forgot-password')
    console.log(`✓ Navigated to: ${page.url()}`)

    // Step 2: Test ForgotPasswordPage form
    console.log('\n--- 2. Testing ForgotPasswordPage ---')
    const forgotEmailInput = page.locator('#forgot-email')
    const sendCodeBtn = page.getByRole('button', { name: /Send Reset Code/i })

    if (!(await forgotEmailInput.isVisible())) throw new Error('Missing #forgot-email input!')
    if (!(await sendCodeBtn.isVisible())) throw new Error('Missing "Send Reset Code" button!')

    await forgotEmailInput.fill('responder.demo@relieflink.org')
    await sendCodeBtn.click()

    // Verify success message appears
    const successMsg = page.locator('text=If an account exists for this email, a 6-digit code has been sent.')
    await successMsg.waitFor({ state: 'visible', timeout: 5000 })
    console.log('✓ Success message displayed after sending reset code')

    // Verify redirect to /reset-password?email=...
    await page.waitForURL(url => url.pathname.includes('/reset-password') && url.search.includes('email=responder.demo%40relieflink.org'), { timeout: 10000 })
    console.log(`✓ Automatically navigated to: ${page.url()}`)

    // Step 3: Test ResetPasswordPage elements
    console.log('\n--- 3. Testing ResetPasswordPage UI ---')
    const codeInput = page.locator('#reset-code')
    const newPasswordInput = page.locator('#reset-password')
    const resetPasswordBtn = page.getByRole('button', { name: /Reset Password/i })

    if (!(await codeInput.isVisible())) throw new Error('Missing #reset-code input!')
    if (!(await newPasswordInput.isVisible())) throw new Error('Missing #reset-password input!')
    if (!(await resetPasswordBtn.isVisible())) throw new Error('Missing "Reset Password" button!')

    // Check back to sign in link
    const backToSignInLink = page.getByRole('link', { name: /Back to sign in/i })
    if (!(await backToSignInLink.isVisible())) throw new Error('Missing "Back to sign in" link!')
    console.log('✓ All ResetPasswordPage inputs and navigation elements are verified')

    // Click back to sign in
    await backToSignInLink.click()
    await page.waitForURL('**/login')
    console.log(`✓ Returned cleanly to: ${page.url()}`)

    console.log('\nALL FORGOT PASSWORD FLOW TESTS PASSED! 🚀')
  } catch (err) {
    console.error('Test run failed:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

runForgotPasswordFlowTests()
