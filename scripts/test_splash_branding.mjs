import { chromium } from '@playwright/test'

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  
  // Test Android mobile dimensions (Pixel 7 / Galaxy S21: 412x915)
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  try {
    console.log('Testing Android mobile dimensions (412x915)...')
    await page.goto('http://localhost:4174/', { waitUntil: 'domcontentloaded' })

    // 1. Verify Splash Screen exists immediately
    const splash = page.locator('[role="dialog"][aria-label="Welcome to ReliefLink"]')
    const isSplashVisible = await splash.isVisible()
    console.log('Splash screen visible immediately:', isSplashVisible)
    if (!isSplashVisible) {
      throw new Error('Splash screen was not immediately visible on startup')
    }

    // 2. Check Logo element
    const logoImg = splash.locator('img[alt="ReliefLink Logo"]')
    const isLogoVisible = await logoImg.isVisible()
    console.log('Brand logo visible in splash screen:', isLogoVisible)
    if (!isLogoVisible) {
      throw new Error('Logo image missing in splash screen')
    }

    // 3. Verify Quote
    const quoteText = await splash.textContent('p')
    console.log('Found quote text snippet:', quoteText?.trim())
    if (!quoteText?.includes('Together, we can turn compassion into action')) {
      throw new Error('Required quote is missing or incorrect')
    }

    // 4. Verify Name and Tagline
    const brandName = await splash.textContent('h1')
    console.log('Found brand heading:', brandName?.trim())
    if (!brandName?.includes('Relief') || !brandName?.includes('Link')) {
      throw new Error('ReliefLink brand name missing')
    }

    const taglineText = await splash.locator('text=/Connecting help. Delivering hope./i').textContent()
    console.log('Found tagline:', taglineText?.trim())
    if (!taglineText?.includes('Connecting help. Delivering hope.')) {
      throw new Error('Required tagline is missing or incorrect')
    }

    // 5. Verify smooth transition to main application
    console.log('Waiting for splash screen transition to main application...')
    await splash.waitFor({ state: 'detached', timeout: 5000 })
    console.log('Splash screen transitioned cleanly!')

    // 6. Verify main app screen is visible (e.g. Home dashboard)
    const homeHeader = page.locator('header')
    await homeHeader.waitFor({ state: 'visible' })
    console.log('Main app Home dashboard header is active and functional!')

    // 7. Verify PWA manifest and favicon in document head
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href')
    console.log('Manifest link href:', manifestLink)
    if (manifestLink !== '/manifest.webmanifest') {
      throw new Error('Manifest link missing')
    }

    const faviconLink = await page.locator('link[rel="icon"]').getAttribute('href')
    console.log('Favicon link href:', faviconLink)
    if (faviconLink !== '/icons/favicon.png') {
      throw new Error('Favicon link missing')
    }

    console.log('\nALL SPLASH SCREEN & PWA BRANDING CHECKS PASSED! ✅')
  } catch (err) {
    console.error('Test failed:', err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

run()
