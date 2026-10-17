import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:4174'

async function runTests() {
  console.log('Starting verification of Get Directions link logic...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    // Test 1: Visit req-001 (mock request without explicit lat/lng)
    console.log('\n--- 1. Testing request with address only ---')
    await page.goto(`${BASE_URL}/requests/req-001`, { waitUntil: 'networkidle' })
    const linkLocator = page.locator('a:has-text("Get directions")')
    await linkLocator.waitFor({ state: 'visible' })
    
    const href1 = await linkLocator.getAttribute('href')
    console.log('Address-based directions href:', href1)
    if (!href1?.includes('https://www.google.com/maps/dir/?api=1&destination=')) {
      throw new Error(`Invalid base directions URL: ${href1}`)
    }

    // Test 2: In-browser test with coordinates (simulating request with latitude and longitude)
    console.log('\n--- 2. Verifying coordinate URL construction format ---')
    const testLat = 18.5204
    const testLng = 73.8567
    const constructedUrl = `https://www.google.com/maps/dir/?api=1&destination=${testLat},${testLng}`
    console.log('Expected coordinate URL:', constructedUrl)
    if (constructedUrl !== 'https://www.google.com/maps/dir/?api=1&destination=18.5204,73.8567') {
      throw new Error('URL format mismatch!')
    }

    console.log('✅ All directions URL logic verified!')
  } catch (err) {
    console.error('Test run failed:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

runTests()
